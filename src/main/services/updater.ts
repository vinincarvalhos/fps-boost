import { app, BrowserWindow, Notification } from 'electron'
import log from 'electron-log/main'
import electronUpdater from 'electron-updater'
import type { UpdaterState } from '@shared/types'
import { store } from './store'

const { autoUpdater } = electronUpdater
const CHECK_EVERY_MS = 3600_000 // hourly: a release reaches people who leave the app in the tray the same day

let state: UpdaterState = { status: app.isPackaged ? 'idle' : 'dev', currentVersion: app.getVersion() }

function publish(patch: Partial<UpdaterState>): UpdaterState {
  state = { ...state, ...patch }
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('updater:changed', state)
  return state
}

export function updaterState(): UpdaterState {
  return state
}

const notes = (n: unknown): string | undefined =>
  typeof n === 'string' ? n.replace(/<[^>]+>/g, '').trim() : Array.isArray(n) ? n.map((x) => x.note).join('\n') : undefined

export function initUpdater(): void {
  if (!app.isPackaged) return // updates only make sense for an installed build
  autoUpdater.logger = log
  autoUpdater.autoDownload = false // the user decides when to download
  autoUpdater.autoInstallOnAppQuit = true

  // keep showing a version already known while GitHub is asked again, so the top bar doesn't flicker
  autoUpdater.on('checking-for-update', () => {
    if (state.status !== 'available') publish({ status: 'checking', error: undefined })
  })
  autoUpdater.on('update-available', (i) => {
    const releaseNotes = notes(i.releaseNotes)
    store.set('knownUpdate', { version: i.version, releaseNotes })
    publish({ status: 'available', version: i.version, releaseNotes, checkedAt: new Date().toISOString() })
    notifyIfAway(i.version)
  })
  autoUpdater.on('update-not-available', () => {
    store.set('knownUpdate', null)
    publish({ status: 'not-available', version: undefined, checkedAt: new Date().toISOString() })
  })
  autoUpdater.on('download-progress', (p) => publish({ status: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (i) => publish({ status: 'downloaded', version: i.version, percent: 100 }))
  autoUpdater.on('error', (err) => publish({ status: 'error', error: friendly(err) }))

  // A version found in an earlier session shows up in the top bar immediately; the check below
  // (started right away, it takes a few seconds against GitHub) confirms or clears it.
  const known = store.get('knownUpdate')
  if (known && isNewer(known.version, app.getVersion())) publish({ status: 'available', version: known.version, releaseNotes: known.releaseNotes })
  else if (known) store.set('knownUpdate', null)
  firstCheck = checkForUpdates()
  setInterval(() => checkForUpdates(), CHECK_EVERY_MS)
}

let firstCheck: Promise<UpdaterState> | null = null

/** "1.2.10" > "1.2.9". Pure, for tests. */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0)
  const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}

let notifiedVersion: string | undefined

/**
 * The banner inside the app only helps if the window is on screen. When it is hidden in the tray
 * or minimized, a Windows notification says so once per version; clicking it opens the app.
 */
function notifyIfAway(version: string): void {
  if (notifiedVersion === version || !Notification.isSupported()) return
  const win = BrowserWindow.getAllWindows()[0]
  if (win && win.isVisible() && !win.isMinimized()) return
  notifiedVersion = version
  const n = new Notification({ title: 'Atualização do FpsBoost', body: `A versão ${version} está disponível. Clique para abrir e baixar.` })
  n.on('click', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
  n.show()
}

function friendly(err: Error): string {
  const m = String(err?.message ?? err)
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|net::/i.test(m)) return 'Sem conexão com o GitHub. Tente de novo quando estiver online.'
  if (/404/.test(m)) return 'Nenhuma versão publicada ainda no GitHub.'
  return m.split('\n')[0].slice(0, 200)
}

export async function checkForUpdates(): Promise<UpdaterState> {
  if (!app.isPackaged) return publish({ status: 'dev' })
  if (state.status === 'downloading' || state.status === 'downloaded') return state
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    publish({ status: 'error', error: friendly(err as Error) })
  }
  return state
}

export async function downloadUpdate(): Promise<UpdaterState> {
  if (state.status !== 'available') return state
  // the remembered version is shown before GitHub answers; electron-updater needs that answer to download
  if (firstCheck) await firstCheck
  if (state.status !== 'available') return state
  publish({ status: 'downloading', percent: 0 })
  autoUpdater.downloadUpdate().catch((err) => publish({ status: 'error', error: friendly(err) }))
  return state
}

export function installUpdate(): void {
  if (state.status === 'downloaded') autoUpdater.quitAndInstall(false, true)
}
