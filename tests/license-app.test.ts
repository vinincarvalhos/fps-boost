import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: {}, BrowserWindow: { getAllWindows: () => [] }, safeStorage: {} }))
vi.mock('electron-log/main', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
import { maskKey, verifyLicenseToken } from '../src/main/services/license'
// @ts-expect-error plain JS module
import { generateKeyPair, signToken } from '../server/lib/token.js'

describe('app license verification', () => {
  const { privateKey, publicKey } = generateKeyPair()
  const payload = { key: 'FPSB-ABCDE-FGHJK-LMNPQ-RSTUV', plan: 'premium', machineId: 'a'.repeat(64), licenseExpiresAt: null, iat: 1, exp: 2 }

  it('accepts a token signed by the server key', () => {
    expect(verifyLicenseToken(signToken(payload, privateKey), publicKey)).toMatchObject({ plan: 'premium' })
  })

  it('rejects a token signed by another key', () => {
    const other = generateKeyPair()
    expect(verifyLicenseToken(signToken(payload, other.privateKey), publicKey)).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifyLicenseToken('not-a-token', publicKey)).toBeNull()
  })

  it('masks the middle of the key', () => {
    expect(maskKey('FPSB-ABCDE-FGHJK-LMNPQ-RSTUV')).toBe('FPSB-ABCDE-•••••-•••••-RSTUV')
  })
})
