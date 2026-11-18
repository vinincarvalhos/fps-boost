import { shell } from 'electron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import log from 'electron-log/main'
import type { Game, GameSettings, OpResult } from '@shared/types'
import { runPs } from '../powershell'
import { store } from '../store'
import { detectAll, type DetectedGame } from './detect'

const DEFAULT_SETTINGS: GameSettings = { highPriority: false, gpuHigh: false, noFso: false }

export function games(): Game[] {
  return store.get('games')
}

function save(list: Game[]): Game[] {
  store.set('games', list)
  return list
}

// ---------- main executable ----------

export const NOT_GAME_EXE =
  /unins|crash|report|redist|vcredist|vc_redist|dxsetup|directx|setup|install|prereq|easyanticheat|eac_|battleye|be_service|cefprocess|helper|updater|launcherpatcher|errorreport|dotnet|ue4prereq|uninstall|touchup|cleanup|vconsole|console|editor|server|dedicated|sdk|tool|config|settings|benchmark|overlay|webhelper|crashpad|cef/i

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/**
 * Ranks executables: the name matching the game (a word of it, or its initials such as
 * "Counter-Strike 2" → cs2) counts most, then file size. Pure, for tests.
 */
export function rankExes(gameName: string, files: { path: string; size: number }[]): string[] {
  const w = words(gameName)
  const acronym = w.map((x) => (/^\d+$/.test(x) ? x : x[0])).join('')
  const score = (p: string, size: number) => {
    const base = words(basename(p, extname(p))).join('')
    let s = size / 1024 ** 2 // MB
    if (base === acronym || w.some((x) => x.length >= 3 && base.includes(x)) || (base.length >= 3 && w.join('').startsWith(base))) s += 100_000
    if (/\\(bin|binaries)\\/i.test(p)) s += 50
    return s
  }
  return files
    .filter((f) => !NOT_GAME_EXE.test(basename(f.path)))
    .sort((a, b) => score(b.path, b.size) - score(a.path, a.size))
    .map((f) => f.path)
}

/** Plausible game executables in the folder (up to 3 levels deep), best first. */
export async function exeCandidates(dir: string, gameName = ''): Promise<string[]> {
  const found: { path: string; size: number }[] = []
  const visit = async (d: string, depth: number) => {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(d, e.name)
      if (e.isDirectory() && !e.isSymbolicLink() && depth < 3 && !/^(redist|_commonredist|directx|support|installers?|__installer)$/i.test(e.name)) await visit(p, depth + 1)
      else if (e.isFile() && extname(e.name).toLowerCase() === '.exe' && !NOT_GAME_EXE.test(e.name)) {
        try {
          found.push({ path: p, size: (await stat(p)).size })
        } catch {
          /* vanished */
        }
      }
    }
  }
  await visit(dir, 0)
  return rankExes(gameName, found).slice(0, 8)
}

// ---------- covers ----------

const norm = (s: string) => s.toLowerCase().replace(/[™®©:'’.\-–_]/g, ' ').replace(/\s+/g, ' ').trim()

/** Finds a Steam app id with the same name, only to show cover art for non-Steam games. */
async function lookupCover(name: string): Promise<number | null> {
  try {
    const res = await fetch(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const list = (await res.json()) as { appid: string; name: string }[]
    const exact = list.find((x) => norm(x.name) === norm(name))
    return exact ? Number(exact.appid) : list[0] && norm(list[0].name).startsWith(norm(name)) ? Number(list[0].appid) : null
  } catch {
    return null
  }
}

// ---------- detection ----------

/** Merges a fresh detection into the saved library, keeping user choices (exe, settings, hidden). */
export function mergeLibrary(saved: Game[], detected: DetectedGame[]): Game[] {
  const byId = new Map(saved.map((g) => [g.id, g]))
  const merged: Game[] = detected.map((d) => {
    const old = byId.get(d.id)
    return {
      ...d,
      exe: old?.exe ?? d.exe,
      coverAppId: d.coverAppId ?? old?.coverAppId,
      hidden: old?.hidden,
      settings: old?.settings ?? { ...DEFAULT_SETTINGS }
    }
  })
  // manual games stay while their exe exists; detected games that disappeared are uninstalled
  for (const g of saved) if (g.source === 'manual' && g.exe && existsSync(g.exe)) merged.push(g)
  return merged.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export async function scanGames(): Promise<Game[]> {
  const list = mergeLibrary(games(), await detectAll())
  // fill in main executables and cover lookups that are still missing
  for (const g of list) {
    // pick again when there is none, or the earlier automatic pick was a tool (vconsole, editor…)
    const needsPick = !g.exe || (NOT_GAME_EXE.test(basename(g.exe)) && !Object.values(g.settings).some(Boolean))
    if (needsPick && existsSync(g.installDir)) g.exe = (await exeCandidates(g.installDir, g.name))[0] ?? g.exe
    if (g.coverAppId === undefined && g.source !== 'steam') g.coverAppId = await lookupCover(g.name)
  }
  return save(list)
}

export async function addManualGame(exe: string): Promise<Game | null> {
  if (!exe.toLowerCase().endsWith('.exe') || !existsSync(exe)) return null
  const name = basename(dirname(exe)).replace(/[_-]+/g, ' ')
  const game: Game = {
    id: `manual:${createHash('sha1').update(exe.toLowerCase()).digest('hex').slice(0, 12)}`,
    name,
    source: 'manual',
    installDir: dirname(exe),
    exe,
    coverAppId: await lookupCover(name),
    settings: { ...DEFAULT_SETTINGS }
  }
  save([...games().filter((g) => g.id !== game.id), game].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
  return game
}

export function updateGame(id: string, patch: Partial<Pick<Game, 'name' | 'exe' | 'hidden'>>): Game | null {
  const list = games()
  const g = list.find((x) => x.id === id)
  if (!g) return null
  if (patch.exe !== undefined && !(patch.exe.toLowerCase().endsWith('.exe') && existsSync(patch.exe))) return null
  Object.assign(g, patch)
  save(list)
  return g
}

export function removeManualGame(id: string): boolean {
  const list = games()
  if (!list.some((g) => g.id === id && g.source === 'manual')) return false
  save(list.filter((g) => g.id !== id))
  return true
}

// ---------- launch ----------

const URI = /^(steam:\/\/rungameid\/\d+|com\.epicgames\.launcher:\/\/apps\/[^\s]+|uplay:\/\/launch\/\d+\/\d+)$/

export async function launchGame(id: string): Promise<OpResult> {
  const g = games().find((x) => x.id === id)
  if (!g) return { ok: false, error: 'Jogo não encontrado.' }
  try {
    if (g.launchUri && URI.test(g.launchUri)) await shell.openExternal(g.launchUri)
    else if (g.exe && existsSync(g.exe)) spawn(g.exe, [], { cwd: dirname(g.exe), detached: true, stdio: 'ignore' }).unref()
    else return { ok: false, error: 'Executável do jogo não encontrado. Escolha o .exe nas opções do jogo.' }
    return { ok: true }
  } catch (err) {
    log.warn('[games] launch', err)
    return { ok: false, error: 'Não foi possível abrir o jogo.' }
  }
}

// ---------- per-game Windows settings ----------

const q = (s: string) => s.replace(/'/g, "''")
const IFEO = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options'
const GPU = 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences'
const LAYERS = 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers'

function settingScript(key: keyof GameSettings, exe: string, on: boolean): string {
  const name = basename(exe)
  switch (key) {
    case 'highPriority':
      return on
        ? `$k = '${IFEO}\\${q(name)}\\PerfOptions'; New-Item -Path $k -Force | Out-Null; New-ItemProperty -Path $k -Name CpuPriorityClass -Value 3 -PropertyType DWord -Force | Out-Null`
        : `Remove-Item -Path '${IFEO}\\${q(name)}\\PerfOptions' -Recurse -ErrorAction SilentlyContinue`
    case 'gpuHigh':
      return on
        ? `New-Item -Path '${GPU}' -Force -ErrorAction SilentlyContinue | Out-Null; New-ItemProperty -Path '${GPU}' -Name '${q(exe)}' -Value 'GpuPreference=2;' -PropertyType String -Force | Out-Null`
        : `Remove-ItemProperty -Path '${GPU}' -Name '${q(exe)}' -ErrorAction SilentlyContinue`
    case 'noFso':
      // keep other compatibility flags the user may have set on the same exe
      return `New-Item -Path '${LAYERS}' -Force -ErrorAction SilentlyContinue | Out-Null
$cur = (Get-ItemProperty -Path '${LAYERS}' -Name '${q(exe)}' -ErrorAction SilentlyContinue).'${q(exe)}'
$flags = @(($cur -replace '^~\\s*', '') -split '\\s+' | ? { $_ -and $_ -ne 'DISABLEDXMAXIMIZEDWINDOWEDMODE' })
${on ? "$flags += 'DISABLEDXMAXIMIZEDWINDOWEDMODE'" : ''}
if ($flags.Count) { New-ItemProperty -Path '${LAYERS}' -Name '${q(exe)}' -Value ('~ ' + ($flags -join ' ')) -PropertyType String -Force | Out-Null }
else { Remove-ItemProperty -Path '${LAYERS}' -Name '${q(exe)}' -ErrorAction SilentlyContinue }`
  }
}

export async function setGameSetting(id: string, key: keyof GameSettings, on: boolean): Promise<OpResult & { game?: Game }> {
  if (!(key in DEFAULT_SETTINGS)) return { ok: false, error: 'Ajuste desconhecido.' }
  const list = games()
  const g = list.find((x) => x.id === id)
  if (!g) return { ok: false, error: 'Jogo não encontrado.' }
  if (!g.exe || !existsSync(g.exe)) return { ok: false, error: 'Escolha o executável do jogo antes.' }
  const r = await runPs(settingScript(key, g.exe, on))
  if (r.code !== 0) return { ok: false, error: r.stderr.split('\n')[0] || 'Não foi possível aplicar.' }
  g.settings = { ...g.settings, [key]: on }
  save(list)
  return { ok: true, game: g }
}

export const _internal = { settingScript }
