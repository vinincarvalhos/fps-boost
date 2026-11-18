import { beforeEach, describe, expect, it } from 'vitest'
// @ts-expect-error plain JS module
import { createLicenseService, normalizeKey, TOKEN_TTL_DAYS } from '../server/lib/core.js'
// @ts-expect-error plain JS module
import { memoryStorage } from '../server/lib/storage.js'
// @ts-expect-error plain JS module
import { generateKeyPair, verifyToken } from '../server/lib/token.js'

const { privateKey, publicKey } = generateKeyPair()
const M1 = 'a'.repeat(64)
const M2 = 'b'.repeat(64)
const M3 = 'c'.repeat(64)

let now = Date.parse('2026-11-18T12:00:00Z')
let svc: ReturnType<typeof createLicenseService>

beforeEach(() => {
  now = Date.parse('2026-11-18T12:00:00Z')
  svc = createLicenseService({ storage: memoryStorage(), privateKey, now: () => now })
})

describe('license server', () => {
  it('normalizes keys typed with spaces, lowercase or missing dashes', () => {
    expect(normalizeKey(' fpsb abcde-fghjk lmnpq rstuv ')).toBe('FPSB-ABCDE-FGHJK-LMNPQ-RSTUV')
    expect(normalizeKey('ABCDEFGHJKLMNPQRSTUV')).toBe('FPSB-ABCDE-FGHJK-LMNPQ-RSTUV')
  })

  it('activates and returns a token the app can verify', async () => {
    const { keys } = await svc.createKeys({ count: 1 })
    const res = await svc.activate({ key: keys[0], machineId: M1, machineName: 'PC' })
    const payload = verifyToken(res.token, publicKey)
    expect(payload).toMatchObject({ key: keys[0], plan: 'premium', machineId: M1 })
    expect(payload.exp - payload.iat).toBe(TOKEN_TTL_DAYS * 86400)
    expect(res.license.machinesUsed).toBe(1)
  })

  it('rejects a tampered token', async () => {
    const { keys } = await svc.createKeys({})
    const { token } = await svc.activate({ key: keys[0], machineId: M1 })
    const [body, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), plan: 'lifetime' })).toString('base64url')
    expect(verifyToken(`${forged}.${sig}`, publicKey)).toBeNull()
  })

  it('enforces the machine limit, and frees a slot on deactivate', async () => {
    const { keys } = await svc.createKeys({ maxMachines: 2 })
    await svc.activate({ key: keys[0], machineId: M1 })
    await svc.activate({ key: keys[0], machineId: M2 })
    await svc.activate({ key: keys[0], machineId: M1 }) // same PC again is fine
    await expect(svc.activate({ key: keys[0], machineId: M3 })).rejects.toMatchObject({ code: 'machine_limit' })
    await svc.deactivate({ key: keys[0], machineId: M2 })
    await expect(svc.activate({ key: keys[0], machineId: M3 })).resolves.toBeTruthy()
  })

  it('refuses unknown, revoked and expired keys', async () => {
    await expect(svc.activate({ key: 'FPSB-AAAAA-AAAAA-AAAAA-AAAAA', machineId: M1 })).rejects.toMatchObject({ code: 'invalid_key' })
    const { keys } = await svc.createKeys({ expiresInDays: 30 })
    await svc.activate({ key: keys[0], machineId: M1 })
    await svc.setStatus({ key: keys[0], status: 'revoked' })
    await expect(svc.validate({ key: keys[0], machineId: M1 })).rejects.toMatchObject({ code: 'revoked' })
    await svc.setStatus({ key: keys[0], status: 'active' })
    now += 31 * 86400000
    await expect(svc.validate({ key: keys[0], machineId: M1 })).rejects.toMatchObject({ code: 'expired' })
  })

  it('validate requires the machine to be activated', async () => {
    const { keys } = await svc.createKeys({})
    await expect(svc.validate({ key: keys[0], machineId: M1 })).rejects.toMatchObject({ code: 'not_activated' })
  })
})
