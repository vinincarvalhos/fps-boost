import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Game } from '@shared/types'
import { runPsJson } from '../powershell'
import { parseVdf, type Vdf } from './vdf'

export type DetectedGame = Omit<Game, 'settings' | 'hidden' | 'coverAppId'> & { coverAppId?: number | null }


/** Steam entries that are tools, not games. */
const STEAM_TOOLS = /^(Steamworks Common Redistributables|Steam Linux Runtime.*|Proton.*|SteamVR.*|Steam Controller Configs|Spacewar)$/i
const STEAM_TOOL_IDS = new Set([228980, 1070560, 1391110, 1628350, 250820])

const asObj = (v: unknown): Vdf => (v && typeof v === 'object' ? (v as Vdf) : {})

/** Reads every Steam library listed in libraryfolders.vdf. Pure parts are exported for tests. */
export function steamGamesFrom(libraryVdf: string, readManifests: (lib: string) => string[]): DetectedGame[] {
  const root = asObj(parseVdf(libraryVdf).libraryfolders)
  const libs = Object.values(root)
    .map((l) => (typeof l === 'object' ? String((l as Vdf).path ?? '') : ''))
    .filter(Boolean)
  const out: DetectedGame[] = []
  for (const lib of libs) {
    for (const text of readManifests(lib)) {
      const st = asObj(parseVdf(text).AppState)
      const appid = Number(st.appid)
      const name = String(st.name ?? '')
      if (!appid || !name || STEAM_TOOL_IDS.has(appid) || STEAM_TOOLS.test(name)) continue
      out.push({
        id: `steam:${appid}`,
        name,
        source: 'steam',
        installDir: join(lib.replace(/\\\\/g, '\\'), 'steamapps', 'common', String(st.installdir ?? '')),
        launchUri: `steam://rungameid/${appid}`,
        steamAppId: appid,
        coverAppId: appid,
        sizeGb: st.SizeOnDisk ? +(Number(st.SizeOnDisk) / 1024 ** 3).toFixed(1) : undefined
      })
    }
  }
  return out
}

async function steam(): Promise<DetectedGame[]> {
  const path = await runPsJson<string>("(Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath")
  const steamPath = (path ?? 'C:/Program Files (x86)/Steam').replace(/\//g, '\\')
  const vdf = join(steamPath, 'steamapps', 'libraryfolders.vdf')
  if (!existsSync(vdf)) return []
  return steamGamesFrom(readFileSync(vdf, 'utf8'), (lib) => {
    const dir = join(lib, 'steamapps')
    try {
      return readdirSync(dir)
        .filter((f) => /^appmanifest_\d+\.acf$/.test(f))
        .map((f) => readFileSync(join(dir, f), 'utf8'))
    } catch {
      return []
    }
  })
}

interface EpicManifest {
  DisplayName?: string
  InstallLocation?: string
  LaunchExecutable?: string
  AppName?: string
  CatalogNamespace?: string
  CatalogItemId?: string
  InstallSize?: number
  bIsApplication?: boolean
  AppCategories?: string[]
  MainGameAppName?: string
}

export function epicGamesFrom(manifests: EpicManifest[]): DetectedGame[] {
  return manifests
    .filter((m) => m.DisplayName && m.InstallLocation && m.AppName && m.bIsApplication !== false)
    .filter((m) => !m.AppCategories || m.AppCategories.includes('games'))
    .filter((m) => !m.MainGameAppName || m.MainGameAppName === m.AppName) // skip DLC
    .map((m) => ({
      id: `epic:${m.AppName}`,
      name: m.DisplayName!,
      source: 'epic' as const,
      installDir: m.InstallLocation!,
      exe: m.LaunchExecutable ? join(m.InstallLocation!, m.LaunchExecutable) : undefined,
      launchUri: `com.epicgames.launcher://apps/${encodeURIComponent(`${m.CatalogNamespace}:${m.CatalogItemId}:${m.AppName}`)}?action=launch&silent=true`,
      sizeGb: m.InstallSize ? +(m.InstallSize / 1024 ** 3).toFixed(1) : undefined
    }))
}

function epic(): DetectedGame[] {
  const dir = join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
  if (!existsSync(dir)) return []
  const list: EpicManifest[] = []
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.item'))) {
    try {
      list.push(JSON.parse(readFileSync(join(dir, f), 'utf8')))
    } catch {
      /* corrupt manifest */
    }
  }
  return epicGamesFrom(list)
}

async function gog(): Promise<DetectedGame[]> {
  const raw = await runPsJson<{ id: string; name: string; path: string; exe: string } | { id: string; name: string; path: string; exe: string }[]>(
    `Get-ChildItem 'HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games' -ErrorAction SilentlyContinue | % {
  $p = Get-ItemProperty $_.PSPath
  if ($p.gameName -and $p.path) { [pscustomobject]@{ id = [string]$p.gameID; name = [string]$p.gameName; path = [string]$p.path; exe = [string]$p.exe } }
}`
  )
  const list = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
  return list
    .filter((g) => existsSync(g.path))
    .map((g) => ({ id: `gog:${g.id}`, name: g.name, source: 'gog' as const, installDir: g.path, exe: g.exe && existsSync(g.exe) ? g.exe : undefined }))
}

async function ubisoft(): Promise<DetectedGame[]> {
  const raw = await runPsJson<{ id: string; dir: string } | { id: string; dir: string }[]>(
    `Get-ChildItem 'HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs' -ErrorAction SilentlyContinue | % {
  $d = (Get-ItemProperty $_.PSPath).InstallDir
  if ($d) { [pscustomobject]@{ id = $_.PSChildName; dir = [string]$d } }
}`
  )
  const list = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
  return list
    .map((u) => ({ ...u, dir: u.dir.replace(/\//g, '\\').replace(/\\$/, '') }))
    .filter((u) => /^\d+$/.test(u.id) && existsSync(u.dir))
    .map((u) => ({
      id: `ubisoft:${u.id}`,
      name: u.dir.split('\\').pop() ?? `Ubisoft ${u.id}`,
      source: 'ubisoft' as const,
      installDir: u.dir,
      launchUri: `uplay://launch/${u.id}/0`
    }))
}

/** Runs every detector; one failing store never hides the others. */
export async function detectAll(): Promise<DetectedGame[]> {
  const results = await Promise.allSettled([steam(), Promise.resolve(epic()), gog(), ubisoft()])
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

