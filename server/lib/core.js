// License rules, independent of HTTP and storage so they can be unit tested.
import { randomBytes } from 'node:crypto'
import { signToken } from './token.js'

export const TOKEN_TTL_DAYS = 7 // how long the app keeps premium offline without revalidating
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid typos

export class LicenseError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function generateKey() {
  const bytes = randomBytes(20)
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
  return `FPSB-${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10, 15)}-${chars.slice(15, 20)}`
}

export function normalizeKey(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^FPSB/, '')
    .replace(/^(.{5})(.{5})(.{5})(.{5})$/, 'FPSB-$1-$2-$3-$4')
}

const isKey = (k) => /^FPSB-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(k)
const isMachine = (m) => typeof m === 'string' && /^[a-f0-9]{64}$/.test(m)

export function createLicenseService({ storage, privateKey, now = () => Date.now() }) {
  const load = async (rawKey) => {
    const key = normalizeKey(rawKey)
    if (!isKey(key)) throw new LicenseError('invalid_key', 'Chave inválida. Confira se digitou todos os caracteres.')
    const lic = await storage.get(`license:${key}`)
    if (!lic) throw new LicenseError('invalid_key', 'Chave não encontrada. Confira se digitou todos os caracteres.')
    if (lic.status === 'revoked') throw new LicenseError('revoked', 'Esta chave foi revogada.', 403)
    if (lic.expiresAt && Date.parse(lic.expiresAt) < now()) throw new LicenseError('expired', 'Esta chave expirou.', 403)
    return lic
  }

  const issue = (lic, machineId) => {
    const iat = Math.floor(now() / 1000)
    const payload = {
      key: lic.key,
      plan: lic.plan,
      machineId,
      licenseExpiresAt: lic.expiresAt,
      iat,
      exp: iat + TOKEN_TTL_DAYS * 86400
    }
    return { token: signToken(payload, privateKey), license: publicView(lic) }
  }

  return {
    async activate({ key, machineId, machineName }) {
      if (!isMachine(machineId)) throw new LicenseError('bad_request', 'Identificação do computador inválida.')
      const lic = await load(key)
      if (!lic.machines[machineId]) {
        if (Object.keys(lic.machines).length >= lic.maxMachines)
          throw new LicenseError(
            'machine_limit',
            `Esta chave já está ativa em ${lic.maxMachines} computador(es). Desative em outro PC para usar aqui.`,
            403
          )
        lic.machines[machineId] = { name: String(machineName ?? 'PC').slice(0, 60), activatedAt: new Date(now()).toISOString() }
        await storage.set(`license:${lic.key}`, lic)
      }
      return issue(lic, machineId)
    },

    async validate({ key, machineId }) {
      const lic = await load(key)
      if (!lic.machines[machineId]) throw new LicenseError('not_activated', 'Esta chave não está ativa neste computador.', 403)
      return issue(lic, machineId)
    },

    async deactivate({ key, machineId }) {
      const key2 = normalizeKey(key)
      const lic = await storage.get(`license:${key2}`)
      if (lic?.machines[machineId]) {
        delete lic.machines[machineId]
        await storage.set(`license:${lic.key}`, lic)
      }
      return { ok: true }
    },

    // ---- admin ----
    async createKeys({ count = 1, plan = 'premium', maxMachines = 2, expiresInDays = null, note = '' }) {
      const n = Math.min(100, Math.max(1, Number(count) || 1))
      const keys = []
      for (let i = 0; i < n; i++) {
        const key = generateKey()
        const lic = {
          key,
          plan: String(plan),
          status: 'active',
          maxMachines: Math.min(20, Math.max(1, Number(maxMachines) || 2)),
          machines: {},
          createdAt: new Date(now()).toISOString(),
          expiresAt: expiresInDays ? new Date(now() + Number(expiresInDays) * 86400000).toISOString() : null,
          note: String(note).slice(0, 200)
        }
        await storage.set(`license:${key}`, lic)
        keys.push(key)
      }
      return { keys }
    },

    async setStatus({ key, status }) {
      if (status !== 'active' && status !== 'revoked') throw new LicenseError('bad_request', 'Status deve ser active ou revoked.')
      const lic = await storage.get(`license:${normalizeKey(key)}`)
      if (!lic) throw new LicenseError('invalid_key', 'Chave não encontrada.', 404)
      lic.status = status
      await storage.set(`license:${lic.key}`, lic)
      return publicView(lic, true)
    },

    async info({ key }) {
      const lic = await storage.get(`license:${normalizeKey(key)}`)
      if (!lic) throw new LicenseError('invalid_key', 'Chave não encontrada.', 404)
      return publicView(lic, true)
    }
  }
}

function publicView(lic, admin = false) {
  return {
    key: lic.key,
    plan: lic.plan,
    status: lic.status,
    maxMachines: lic.maxMachines,
    machinesUsed: Object.keys(lic.machines).length,
    expiresAt: lic.expiresAt,
    ...(admin ? { machines: lic.machines, createdAt: lic.createdAt, note: lic.note } : {})
  }
}
