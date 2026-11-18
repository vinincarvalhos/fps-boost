import { BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import log from 'electron-log/main'
import type { Game, GameModePrefs, GameModeState } from '@shared/types'
import { games } from './games/library'
import { isPremium } from './license'
import { freeMemory } from './memory'
import { runPs, runPsJson } from './powershell'
import { logActivity, store } from './store'

const HIGH_PERFORMANCE = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
const POLL_MS = 5000

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
let watchTimer: NodeJS.Timeout | null = null
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

async function runningPaths(): Promise<string[]> {
  const r = await runPsJson<string | string[]>('Get-Process | ? { $_.Path } | % { $_.Path }', 20_000)
  return r == null ? [] : Array.isArray(r) ? r : [r]
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

  if (prefs.freeRam) {
    const r = await freeMemory()
    if (r.ok) applied.push(`${Math.round(r.freedMb)} MB de RAM liberados`)
  }

  if (prefs.raisePriority && game) {
    const g = games().find((x) => x.id === game.id)
    if (g?.installDir) {
      const dir = g.installDir.replace(/'/g, "''").replace(/[\\/]+$/, '') + '\\'
      const r = await runPs(`Get-Process | ? { $_.Path -and $_.Path.StartsWith('${dir}', 'OrdinalIgnoreCase') } | % { try { $_.PriorityClass = 'High' } catch {} }`)
      if (r.code === 0) applied.push('Prioridade alta para o jogo')
    }
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

async function poll(): Promise<void> {
  try {
    if (!gameModePrefs().autoActivate || !isPremium()) return
    const running = findRunningGame(await runningPaths(), games())
    if (running && !state.active) {
      log.info('[gamemode] jogo detectado', running.name)
      await activate(running, false)
    } else if (!running && state.active && !state.manual) {
      // two quiet polls in a row, so a launcher restarting the game doesn't flip it off
      if (++missedPolls >= 2) await deactivate()
    } else missedPolls = 0
  } catch (err) {
    log.warn('[gamemode] poll', err)
  }
}

export function setPrefs(patch: Partial<GameModePrefs>): GameModePrefs {
  const next = { ...gameModePrefs(), ...patch }
  next.services = next.services.filter((s) => PAUSABLE_SERVICES.some((p) => p.name === s))
  store.set('gameModePrefs', next)
  return next
}

export async function initGameMode(): Promise<void> {
  await restoreSaved() // undo a session interrupted by a crash or forced close
  watchTimer = setInterval(poll, POLL_MS)
}

export async function shutdownGameMode(): Promise<void> {
  if (watchTimer) clearInterval(watchTimer)
  await deactivate()
  releaseTimer()
}
