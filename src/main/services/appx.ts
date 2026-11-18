import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppxEntry, AppxPreset, AppxRemoved, OpResult } from '@shared/types'
import { runPs, runPsJson } from './powershell'
import { store } from './store'

interface CatalogItem {
  name: string
  title: string
  description: string
  preset: AppxPreset | null
  storeId?: string
}

/**
 * Packages that are never listed or removed: the Store and winget, Terminal, Windows Security,
 * media codecs, runtimes/frameworks and core shell components.
 */
export const PROTECTED: RegExp[] = [
  /^Microsoft\.WindowsStore$/i,
  /^Microsoft\.StorePurchaseApp$/i,
  /^Microsoft\.DesktopAppInstaller$/i,
  /^Microsoft\.WindowsTerminal/i,
  /^Microsoft\.SecHealthUI$/i,
  /^Microsoft\.XboxIdentityProvider$/i,
  /Extension(s)?$/i, // HEIF/HEVC/VP9/AV1/WebP/Raw codecs
  /^Microsoft\.(VCLibs|UI\.Xaml|NET\.|Services\.Store|WindowsAppRuntime|DirectXRuntime)/i,
  /^MicrosoftWindows\./i,
  /^Microsoft\.Windows\.(ShellExperienceHost|StartMenuExperienceHost|CloudExperienceHost|ContentDeliveryManager|SecHealthUI|Search|PeopleExperienceHost|Apprep|AssignedAccessLockApp|CapturePicker|OOBE|ParentalControls|PinningConfirmationDialog|XGpuEjectDialog|NarratorQuickStart|CallingShellApp)/i,
  /^Microsoft\.(AAD|AccountsControl|AsyncTextService|BioEnrollment|CredDialogHost|ECApp|LockApp|Win32WebViewHost|LanguageExperiencePack)/i,
  /^Microsoft\.MicrosoftEdge/i, // Edge is reinstalled by Windows anyway
  /^windows\./i,
  /^(Microsoft\.)?Windows\.(Client|CBSPreview|PrintDialog)/i,
  /^NcsiUwpApp$/i,
  /^c5e2524a-ea46-4f67-841f-6a9465d9d515$/i,
  /^E2A4F912-2574-4A75-9BB0-0D023378592B$/i,
  /^F46D4000-FD22-4DB4-AC8E-4E1DDDE828FE$/i,
  /^1527c705-839a-4832-9118-54d4Bd6a0c89$/i
]

export const isProtected = (name: string) => PROTECTED.some((r) => r.test(name))

let catalogCache: CatalogItem[] | null = null
function catalog(): CatalogItem[] {
  if (!catalogCache) {
    const file = app.isPackaged ? join(process.resourcesPath, 'appx-catalog.json') : join(app.getAppPath(), 'resources', 'appx-catalog.json')
    catalogCache = JSON.parse(readFileSync(file, 'utf8')) as CatalogItem[]
  }
  return catalogCache
}

interface RawPkg {
  Name: string
  Version: string
  IsFramework: boolean
  NonRemovable: boolean
  SignatureKind: number | string
}

/** Merges installed packages with the catalog. Pure, for tests. */
export function mergeCatalog(installed: RawPkg[], cat: CatalogItem[]): AppxEntry[] {
  const removable = installed.filter(
    (p) => !p.IsFramework && !p.NonRemovable && String(p.SignatureKind) !== 'System' && String(p.SignatureKind) !== '3' && !isProtected(p.Name)
  )
  const byName = new Map(removable.map((p) => [p.Name.toLowerCase(), p]))
  const out: AppxEntry[] = cat
    .filter((c) => !isProtected(c.name))
    .map((c) => {
      const p = byName.get(c.name.toLowerCase())
      return { name: c.name, title: c.title, description: c.description, preset: c.preset, storeId: c.storeId, installed: !!p, version: p?.Version }
    })
  const known = new Set(cat.map((c) => c.name.toLowerCase()))
  for (const p of removable)
    if (!known.has(p.Name.toLowerCase())) out.push({ name: p.Name, title: p.Name, description: 'Instalado neste PC, fora do catálogo do FpsBoost.', preset: null, installed: true, version: p.Version })
  return out
}

export const PRESET_ORDER: AppxPreset[] = ['basic', 'recommended', 'extreme']
/** Whether an entry belongs to the chosen preset (presets are cumulative). */
export const inPreset = (entry: { preset: AppxPreset | null }, preset: AppxPreset) =>
  entry.preset != null && PRESET_ORDER.indexOf(entry.preset) <= PRESET_ORDER.indexOf(preset)

export async function listAppx(): Promise<AppxEntry[]> {
  const raw = await runPsJson<RawPkg | RawPkg[]>(
    'Get-AppxPackage | Select-Object Name, Version, IsFramework, NonRemovable, @{n="SignatureKind";e={[string]$_.SignatureKind}}',
    60_000
  )
  const list = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
  return mergeCatalog(list, catalog())
}

const q = (s: string) => s.replace(/'/g, "''")

/** Removes for the current user and from the system image, so new accounts don't get it back. */
export async function removeAppx(names: string[], onProgress: (name: string, done: number) => void): Promise<OpResult> {
  const known = new Map((await listAppx()).map((e) => [e.name, e]))
  const failed: { id: string; error: string }[] = []
  let done = 0
  for (const name of names) {
    const entry = known.get(name)
    if (!entry || isProtected(name)) {
      failed.push({ id: name, error: 'App protegido ou não encontrado' })
      continue
    }
    onProgress(name, done)
    const r = await runPs(
      `Get-AppxPackage -Name '${q(name)}' | Remove-AppxPackage -ErrorAction Stop
       Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | ? DisplayName -eq '${q(name)}' | Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Out-Null`,
      180_000
    )
    if (r.code === 0) {
      done++
      const history = store.get('appxHistory').filter((h) => h.name !== name)
      store.set('appxHistory', [{ name, title: entry.title, storeId: entry.storeId, removedAt: new Date().toISOString() }, ...history])
    } else failed.push({ id: name, error: r.stderr.split('\n')[0] || 'Falha ao remover' })
  }
  return { ok: failed.length === 0, done, failed }
}

export function appxHistory(): AppxRemoved[] {
  return store.get('appxHistory')
}

/** Reinstalls from the Microsoft Store via winget. Only for catalog apps with a known Store id. */
export async function restoreAppx(name: string): Promise<OpResult> {
  const h = store.get('appxHistory').find((x) => x.name === name)
  if (!h) return { ok: false, error: 'App não está no histórico de removidos.' }
  if (!h.storeId || !/^[A-Z0-9]{12}$/.test(h.storeId))
    return { ok: false, error: `Reinstale "${h.title}" pela Microsoft Store; o FpsBoost não sabe o código dele na loja.` }
  const r = await runPs(
    `winget install --id ${h.storeId} --source msstore --accept-package-agreements --accept-source-agreements --disable-interactivity --silent; if ($LASTEXITCODE -ne 0) { throw "winget saiu com código $LASTEXITCODE" }`,
    600_000
  )
  if (r.code !== 0) return { ok: false, error: r.stderr.split('\n')[0] || 'A reinstalação falhou.' }
  store.set('appxHistory', store.get('appxHistory').filter((x) => x.name !== name))
  return { ok: true, done: 1 }
}
