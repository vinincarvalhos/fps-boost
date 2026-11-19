import { BrowserWindow } from 'electron'
import os from 'node:os'
import { spawn, type ChildProcess } from 'node:child_process'
import log from 'electron-log/main'
import { GAME_MODE_ENABLED, type Game, type GameModePrefs, type GameModeState } from '@shared/types'
import { games } from './games/library'
import { isPremium } from './license'
import { freeMemory } from './memory'
import { runPs, runPsJson } from './powershell'

const PS_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command']
import { logActivity, store } from './store'

const HIGH_PERFORMANCE = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
const POLL_SECONDS = 5
/** Below this share of free RAM, Game mode trims background programs. Above it, trimming only costs CPU. */
const LOW_RAM = 0.2

/** Services that may be paused while playing. Only ones that are safe to stop and restart. */
export const PAUSABLE_SERVICES: { name: string; label: string; description: string }[] = [
  { name: 'WSearch', label: 'Windows Search', description: 'Indexação de arquivos para a busca do Iniciar.' },
  { name: 'SysMain', label: 'SysMain', description: 'Pré-carregamento de programas na memória.' },
  { name: 'DiagTrack', label: 'Telemetria', description: 'Envio de dados de uso para a Microsoft.' },
  { name: 'Spooler', label: 'Spooler de impressão', description: 'Fila de impressão. Ninguém imprime jogando.' },
  { name: 'wuauserv', label: 'Windows Update', description: 'Evita downloads de atualização no meio da partida.' }
]
const SERVICE_NAME = /^[A-Za-z0-9_.-]{2,64}$/

export const DEFAULT_PREFS: GameModePrefs = {
  autoActivate: false,
  powerPlan: true,
  timerResolution: true,
  freeRam: true,
  raisePriority: true,
  stopServices: true,
  services: ['WSearch', 'SysMain', 'DiagTrack', 'Spooler']
}

let state: GameModeState = { active: false, manual: false, applied: [] }
let timerProc: ChildProcess | null = null
let licenseTimer: NodeJS.Timeout | null = null
let missedPolls = 0

function publish(patch: Partial<GameModeState>): GameModeState {
  state = { ...state, ...patch }
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('gamemode:changed', state)
  return state
}

export const gameModeState = () => state
export const gameModePrefs = (): GameModePrefs => ({ ...DEFAULT_PREFS, ...store.get('gameModePrefs') })

// ---------- detection ----------

/** Which library game owns one of the running executables (by install folder). Pure, for tests. */
export function findRunningGame(paths: string[], library: Pick<Game, 'id' | 'name' | 'installDir' | 'hidden'>[]): { id: string; name: string } | null {
  const lower = paths.map((p) => p.toLowerCase())
  for (const g of library) {
    if (g.hidden || !g.installDir || g.installDir.length < 6) continue
    const dir = g.installDir.toLowerCase().replace(/[\\/]+$/, '') + '\\'
    if (lower.some((p) => p.startsWith(dir))) return { id: g.id, name: g.name }
  }
  return null
}

// One long-lived PowerShell lists running executables every few seconds. Starting a new
// powershell.exe per check costs far more CPU than the check itself, and it ran during games.
const WATCH_SCRIPT = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
while ($true) {
  $p = @(Get-Process | ? { $_.Path } | % { $_.Path } | Sort-Object -Unique)
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $p -Compress))
  [Console]::Out.Flush()
  Start-Sleep -Seconds ${POLL_SECONDS}
}`

let watcher: ChildProcess | null = null
let stopping = false

function startWatcher(): void {
  if (watcher) return
  stopping = false
  const proc = spawn('powershell.exe', [...PS_ARGS, WATCH_SCRIPT], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
  watcher = proc
  let buf = ''
  proc.stdout?.on('data', (d: Buffer) => {
    buf += d.toString()
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        const v = JSON.parse(line) as string[] | string | null
        onPaths(v == null ? [] : Array.isArray(v) ? v : [v])
      } catch {
        /* partial or odd line */
      }
    }
  })
  proc.on('error', (e) => log.warn('[gamemode] watcher', e))
  proc.on('exit', () => {
    if (watcher === proc) watcher = null
    // restart after a crash, but not when it was stopped on purpose
    if (!stopping) setTimeout(syncWatcher, 10_000)
  })
}

function stopWatcher(): void {
  stopping = true
  watcher?.kill()
  watcher = null
}

/** Runs the watcher only while automatic activation is on and the license allows it. */
function syncWatcher(): void {
  if (GAME_MODE_ENABLED && gameModePrefs().autoActivate && isPremium()) startWatcher()
  else stopWatcher()
}

// ---------- timer resolution helper ----------

// A tiny PowerShell process that holds a 0.5 ms timer resolution until it is killed.
const TIMER_SCRIPT = `
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class T { [DllImport("ntdll.dll")] public static extern int NtSetTimerResolution(uint d, bool s, out uint c); }'
$c = 0; [void][T]::NtSetTimerResolution(5000, $true, [ref]$c)
while ($true) { Start-Sleep -Seconds 3600 }`

function holdTimer(): void {
  timerProc?.kill()
  timerProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', TIMER_SCRIPT], { windowsHide: true, stdio: 'ignore' })
  timerProc.on('error', (e) => log.warn('[gamemode] timer', e))
}

function releaseTimer(): void {
  timerProc?.kill()
  timerProc = null
}

// ---------- activate / deactivate ----------

interface RestoreInfo {
  previousPlan?: string
  stoppedServices: string[]
}

export async function activate(game: { id: string; name: string } | null, manual: boolean): Promise<GameModeState> {
  if (state.active) return state
  if (!GAME_MODE_ENABLED) return publish({ error: 'O Modo jogo está desligado nesta versão enquanto é corrigido.' })
  if (!isPremium()) return publish({ error: 'O Modo jogo faz parte do plano Premium. Ative sua chave em Licença.' })
  const prefs = gameModePrefs()
  const applied: string[] = []
  const restore: RestoreInfo = { stoppedServices: [] }

  if (prefs.powerPlan) {
    const cur = await runPs('powercfg /getactivescheme')
    const guid = /([0-9a-f]{8}-[0-9a-f-]{27})/i.exec(cur.stdout)?.[1]
    // prefer FpsBoost's own Ultimate Performance copy when that tweak created one
    const ultimate = ((await runPsJson<string>("(Get-ItemProperty 'HKLM:\\SOFTWARE\\FpsBoost\\Stash\\ultimate-performance-plan' -ErrorAction SilentlyContinue).Created")) ?? '').toLowerCase()
    const best = /^[0-9a-f-]{36}$/.test(ultimate) ? ultimate : HIGH_PERFORMANCE
    if (guid && guid.toLowerCase() !== best) {
      const target = best
      if ((await runPs(`powercfg /setactive ${target}`)).code === 0) {
        restore.previousPlan = guid
        applied.push('Plano de energia de alto desempenho')
      }
    }
  }

  if (prefs.stopServices) {
    for (const name of prefs.services.filter((s) => SERVICE_NAME.test(s))) {
      const r = await runPs(`$s = Get-Service -Name '${name}' -ErrorAction SilentlyContinue; if ($s -and $s.Status -eq 'Running') { Stop-Service -Name '${name}' -Force; 'stopped' }`, 30_000)
      if (r.code === 0 && r.stdout.includes('stopped')) restore.stoppedServices.push(name)
    }
    if (restore.stoppedServices.length) applied.push(`${restore.stoppedServices.length} serviço(s) pausado(s)`)
  }

  // saved before anything else can fail, so a crash still gets undone on the next start
  store.set('gameModeRestore', restore)

  if (prefs.timerResolution) {
    holdTimer()
    applied.push('Timer do sistema em 0,5 ms')
  }

  const gameDir = game ? games().find((x) => x.id === game.id)?.installDir?.replace(/[\\/]+$/, '') : undefined

  // Trimming every program's memory makes them fault it back in (CPU spikes, hitches), so it only
  // happens when RAM is actually short, never touches the game and keeps the file cache.
  if (prefs.freeRam && os.freemem() / os.totalmem() < LOW_RAM) {
    const r = await freeMemory({ skipDir: gameDir ? gameDir + '\\' : undefined, purgeStandby: false })
    if (r.ok) applied.push(`${Math.round(r.freedMb)} MB de RAM liberados`)
  }

  // AboveNormal, not High: High starves audio, input and the game's own helper threads (stutter).
  if (prefs.raisePriority && gameDir) {
    const dir = gameDir.replace(/'/g, "''") + '\\'
    const r = await runPs(`Get-Process | ? { $_.Path -and $_.Path.StartsWith('${dir}', 'OrdinalIgnoreCase') } | % { try { $_.PriorityClass = 'AboveNormal' } catch {} }`)
    if (r.code === 0) applied.push('Prioridade acima do normal para o jogo')
  }

  logActivity({ kind: 'gamemode', title: game ? `Modo jogo: ${game.name}` : 'Modo jogo ativado' })
  return publish({ active: true, manual, game: game ?? undefined, since: new Date().toISOString(), applied, error: undefined })
}

/** Undoes whatever the last activation changed. Also used at startup after a crash. */
export async function restoreSaved(): Promise<void> {
  const r = store.get('gameModeRestore') as RestoreInfo | null
  releaseTimer()
  if (!r) return
  if (r.previousPlan && /^[0-9a-f-]{36}$/i.test(r.previousPlan)) await runPs(`powercfg /setactive ${r.previousPlan}`)
  for (const name of r.stoppedServices.filter((s) => SERVICE_NAME.test(s))) await runPs(`Start-Service -Name '${name}' -ErrorAction SilentlyContinue`, 30_000)
  store.set('gameModeRestore', null)
}

export async function deactivate(): Promise<GameModeState> {
  if (!state.active) return state
  await restoreSaved()
  missedPolls = 0
  return publish({ active: false, manual: false, game: undefined, since: undefined, applied: [] })
}

// ---------- watcher ----------

let handling = false

async function onPaths(paths: string[]): Promise<void> {
  if (handling) return // an activation is still running; the next reading comes in a few seconds
  handling = true
  try {
    if (!gameModePrefs().autoActivate || !isPremium()) return
    const running = findRunningGame(paths, games())
    if (running && !state.active) {
      log.info('[gamemode] jogo detectado', running.name)
      await activate(running, false)
    } else if (!running && state.active && !state.manual) {
      // two quiet readings in a row, so a launcher restarting the game doesn't flip it off
      if (++missedPolls >= 2) await deactivate()
    } else missedPolls = 0
  } catch (err) {
    log.warn('[gamemode] poll', err)
  } finally {
    handling = false
  }
}

export function setPrefs(patch: Partial<GameModePrefs>): GameModePrefs {
  const next = { ...gameModePrefs(), ...patch }
  next.services = next.services.filter((s) => PAUSABLE_SERVICES.some((p) => p.name === s))
  store.set('gameModePrefs', next)
  syncWatcher()
  return next
}

export async function initGameMode(): Promise<void> {
  await restoreSaved() // undo a session interrupted by a crash or forced close
  syncWatcher()
  // the license can change while the app is open (activation, expiry)
  licenseTimer = setInterval(syncWatcher, 60_000)
}

export async function shutdownGameMode(): Promise<void> {
  if (licenseTimer) clearInterval(licenseTimer)
  stopWatcher()
  await deactivate()
  releaseTimer()
}
