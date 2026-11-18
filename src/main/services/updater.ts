import { app, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import electronUpdater from 'electron-updater'
import type { UpdaterState } from '@shared/types'

const { autoUpdater } = electronUpdater
const CHECK_EVERY_MS = 6 * 3600_000

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

  autoUpdater.on('checking-for-update', () => publish({ status: 'checking', error: undefined }))
  autoUpdater.on('update-available', (i) => publish({ status: 'available', version: i.version, releaseNotes: notes(i.releaseNotes), checkedAt: new Date().toISOString() }))
  autoUpdater.on('update-not-available', () => publish({ status: 'not-available', checkedAt: new Date().toISOString() }))
  autoUpdater.on('download-progress', (p) => publish({ status: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (i) => publish({ status: 'downloaded', version: i.version, percent: 100 }))
  autoUpdater.on('error', (err) => publish({ status: 'error', error: friendly(err) }))

  setTimeout(() => checkForUpdates(), 10_000)
  setInterval(() => checkForUpdates(), CHECK_EVERY_MS)
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
  publish({ status: 'downloading', percent: 0 })
  autoUpdater.downloadUpdate().catch((err) => publish({ status: 'error', error: friendly(err) }))
  return state
}

export function installUpdate(): void {
  if (state.status === 'downloaded') autoUpdater.quitAndInstall(false, true)
}
