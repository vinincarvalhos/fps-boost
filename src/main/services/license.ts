import { app, BrowserWindow, safeStorage } from 'electron'
import { createHash, createPublicKey, verify } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import log from 'electron-log/main'
import type { LicenseResult, LicenseState } from '@shared/types'
import { LICENSE_PUBLIC_KEY } from './license-key'
import { runPs } from './powershell'

const API = (import.meta.env.MAIN_VITE_LICENSE_API as string | undefined) ?? 'https://fps-boost-server.vercel.app'
const REFRESH_EVERY_MS = 12 * 3600_000

interface TokenPayload {
  key: string
  plan: string
  machineId: string
  licenseExpiresAt: string | null
  iat: number
  exp: number
}
interface Saved {
  key: string
  token: string
}
interface ServerLicense {
  machinesUsed: number
  maxMachines: number
  expiresAt: string | null
}

const file = () => join(app.getPath('userData'), 'license.dat')

// ---------- machine id ----------

let machineIdCache: string | null = null
/** SHA-256 of the Windows MachineGuid: stable per Windows install, reveals nothing about the PC. */
export async function machineId(): Promise<string> {
  if (machineIdCache) return machineIdCache
  const res = await runPs("(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid")
  const guid = res.stdout.trim() || hostname()
  machineIdCache = createHash('sha256').update(`fpsboost:${guid}`).digest('hex')
  return machineIdCache
}

// ---------- storage (encrypted with the Windows user's DPAPI key) ----------

function readSaved(): Saved | null {
  try {
    if (!existsSync(file())) return null
    const raw = readFileSync(file())
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8')
    return JSON.parse(json) as Saved
  } catch (err) {
    log.warn('[license] arquivo de licença ilegível', err)
    return null
  }
}

function writeSaved(s: Saved | null): void {
  if (!s) {
    rmSync(file(), { force: true })
    return
  }
  const json = JSON.stringify(s)
  writeFileSync(file(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json))
}

// ---------- token ----------

export function verifyLicenseToken(token: string, publicKeyB64 = LICENSE_PUBLIC_KEY): TokenPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' })
    if (!verify(null, Buffer.from(body), key, Buffer.from(sig, 'base64url'))) return null
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload
  } catch {
    return null
  }
}

export const maskKey = (k: string) => k.replace(/^(FPSB-[A-Z0-9]{5})-[A-Z0-9]{5}-[A-Z0-9]{5}-([A-Z0-9]{5})$/, '$1-•••••-•••••-$2')

// ---------- state ----------

let state: LicenseState = { plan: 'free', status: 'none' }
let serverInfo: ServerLicense | null = null

function computeState(message?: string, forceStatus?: LicenseState['status']): LicenseState {
  const saved = readSaved()
  if (!saved) return { plan: 'free', status: forceStatus ?? 'none', message }
  const p = verifyLicenseToken(saved.token)
  const base = {
    maskedKey: maskKey(saved.key),
    machinesUsed: serverInfo?.machinesUsed,
    maxMachines: serverInfo?.maxMachines,
    licenseExpiresAt: p?.licenseExpiresAt ?? serverInfo?.expiresAt ?? null,
    message
  }
  if (!p || p.machineId !== machineIdCache || p.key !== saved.key) return { plan: 'free', status: 'error', ...base, message: message ?? 'Licença inválida para este computador. Ative a chave novamente.' }
  if (p.exp * 1000 < Date.now())
    return { plan: 'free', status: 'lapsed', ...base, message: message ?? 'Conecte-se à internet para revalidar a licença.' }
  return {
    plan: p.plan === 'premium' ? 'premium' : 'free',
    status: forceStatus ?? 'active',
    validUntil: new Date(p.exp * 1000).toISOString(),
    ...base
  }
}

function publish(next: LicenseState): LicenseState {
  state = next
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('license:changed', state)
  return state
}

export function licenseState(): LicenseState {
  return state
}

export function isPremium(): boolean {
  return state.plan === 'premium'
}

// ---------- server calls ----------

class NetworkError extends Error {}

async function call<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    })
  } catch (err) {
    throw new NetworkError(`Sem conexão com o servidor de licenças (${(err as Error).message})`)
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string }
  if (!res.ok) throw Object.assign(new Error(data.message ?? `Erro ${res.status}`), { code: data.error ?? 'server_error' })
  return data
}

export async function activate(rawKey: string): Promise<LicenseResult> {
  try {
    const id = await machineId()
    const { token, license } = await call<{ token: string; license: ServerLicense & { key: string } }>('/api/activate', {
      key: rawKey,
      machineId: id,
      machineName: hostname()
    })
    serverInfo = license
    writeSaved({ key: license.key, token })
    log.info('[license] ativada', maskKey(license.key))
    return { ok: true, state: publish(computeState()) }
  } catch (err) {
    return { ok: false, state, error: (err as Error).message }
  }
}

export async function deactivate(): Promise<LicenseResult> {
  const saved = readSaved()
  if (saved) {
    try {
      await call('/api/deactivate', { key: saved.key, machineId: await machineId() })
    } catch (err) {
      // Offline: still remove locally; the slot frees when the user deactivates again online.
      if (!(err instanceof NetworkError)) log.warn('[license] desativar', err)
      else return { ok: false, state, error: 'Sem conexão: conecte-se à internet para liberar esta máquina na chave.' }
    }
  }
  writeSaved(null)
  serverInfo = null
  return { ok: true, state: publish(computeState()) }
}

/** Revalidates online. Network failures keep the current token; refusals drop to free. */
export async function refresh(): Promise<LicenseState> {
  await machineId()
  const saved = readSaved()
  if (!saved) return publish(computeState())
  try {
    const { token, license } = await call<{ token: string; license: ServerLicense }>('/api/validate', { key: saved.key, machineId: machineIdCache })
    serverInfo = license
    writeSaved({ key: saved.key, token })
    return publish(computeState())
  } catch (err) {
    if (err instanceof NetworkError) {
      const s = computeState()
      return publish(s.plan === 'premium' ? { ...s, status: 'offline' } : s)
    }
    log.warn('[license] recusada pelo servidor', (err as Error).message)
    writeSaved({ key: saved.key, token: '' })
    return publish({ ...computeState((err as Error).message), plan: 'free', status: 'error' })
  }
}

export async function initLicense(): Promise<void> {
  await machineId()
  publish(computeState())
  refresh().catch((err) => log.warn('[license] refresh inicial', err))
  setInterval(() => refresh().catch(() => undefined), REFRESH_EVERY_MS)
}
