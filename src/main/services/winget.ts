import { app } from 'electron'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { OpResult, WingetApp } from '@shared/types'
import { runPs } from './powershell'

type CatalogItem = Omit<WingetApp, 'installed'>

function catalog(): CatalogItem[] {
  const file = app.isPackaged ? join(process.resourcesPath, 'winget-catalog.json') : join(app.getAppPath(), 'resources', 'winget-catalog.json')
  return JSON.parse(readFileSync(file, 'utf8')) as CatalogItem[]
}

const ID = /^[A-Za-z0-9][A-Za-z0-9.+_-]{2,80}$/

export async function wingetAvailable(): Promise<boolean> {
  return (await runPs('winget --version', 20_000)).code === 0
}

/** Installed package ids, from `winget export` (only packages winget can match to a source). */
async function installedIds(): Promise<Set<string>> {
  const file = join(app.getPath('temp'), `fpsboost-winget-${Date.now()}.json`)
  try {
    await runPs(`winget export -o '${file.replace(/'/g, "''")}' --accept-source-agreements --disable-interactivity | Out-Null`, 120_000)
    const data = JSON.parse(readFileSync(file, 'utf8')) as { Sources?: { Packages?: { PackageIdentifier: string }[] }[] }
    return new Set((data.Sources ?? []).flatMap((s) => (s.Packages ?? []).map((p) => p.PackageIdentifier.toLowerCase())))
  } catch {
    return new Set()
  } finally {
    rmSync(file, { force: true })
  }
}

export async function listWinget(): Promise<{ available: boolean; apps: WingetApp[] }> {
  const available = await wingetAvailable()
  const installed = available ? await installedIds() : new Set<string>()
  return { available, apps: catalog().map((c) => ({ ...c, installed: installed.has(c.id.toLowerCase()) })) }
}

/** Installs catalog apps one after another, silently. */
export async function installWinget(ids: string[], onProgress: (id: string, done: number) => void): Promise<OpResult> {
  const allowed = new Set(catalog().map((c) => c.id))
  const failed: { id: string; error: string }[] = []
  let done = 0
  for (const id of ids) {
    if (!allowed.has(id) || !ID.test(id)) {
      failed.push({ id, error: 'App fora do catálogo' })
      continue
    }
    onProgress(id, done)
    const r = await runPs(
      `winget install --id '${id}' -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Null; $c = $LASTEXITCODE
       # -1978335189 = already installed and up to date
       if ($c -ne 0 -and $c -ne -1978335189) { throw "winget saiu com código $c" }`,
      30 * 60_000
    )
    if (r.code === 0) done++
    else failed.push({ id, error: r.stderr.split('\n')[0] || 'Falha na instalação' })
  }
  return { ok: failed.length === 0, done, failed }
}
