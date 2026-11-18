import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { MemoryResult, ProgressEvent } from '@shared/types'
import { appxHistory, listAppx, removeAppx, restoreAppx } from '../services/appx'
import { analyze, clean, isForbiddenRoot } from '../services/cleaner'
import { isPremium } from '../services/license'
import { freeMemory, memoryInfo } from '../services/memory'
import { runPs } from '../services/powershell'
import { findLeftovers, listPrograms, removeLeftovers, uninstallProgram } from '../services/programs'
import { cleanRegistry, scanRegistry } from '../services/registryClean'
import { logActivity, store } from '../services/store'
import { installWinget, listWinget } from '../services/winget'
import { registryBackupDir } from './tweaks'

const PREMIUM = 'A limpeza faz parte do plano Premium. Ative sua chave em Licença.'
const BUSY = 'Já existe uma operação desse tipo em andamento.'

function progress(e: ProgressEvent): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('progress', e)
}

let adminCache: boolean | null = null
async function isAdmin(): Promise<boolean> {
  adminCache ??=
    (
      await runPs(
        '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
      )
    ).stdout === 'True'
  return adminCache
}

/** One long operation at a time per kind, so double clicks don't run things twice. */
const running = new Set<string>()
async function exclusive<T>(kind: string, busy: T, job: () => Promise<T>): Promise<T> {
  if (running.has(kind)) return busy
  running.add(kind)
  try {
    return await job()
  } finally {
    running.delete(kind)
  }
}

const ids = (x: unknown) => (Array.isArray(x) ? x.map(String) : [])
const memFail = (error: string): MemoryResult => ({ ok: false, beforeMb: 0, afterMb: 0, freedMb: 0, trimmed: 0, standbyPurged: false, error })

export function registerPhase3Ipc(): void {
  // ---- files ----
  ipcMain.handle('clean:analyze', async () => {
    const admin = await isAdmin()
    let n = 0
    return analyze(store.get('cleanFolders'), admin, (id) => progress({ op: 'analyze', current: id, done: n++, total: 12 }))
  })

  ipcMain.handle('clean:run', (_e, list: unknown) =>
    exclusive('clean', { ok: false, error: BUSY }, async () => {
      if (!isPremium()) return { ok: false, error: PREMIUM }
      const sel = ids(list)
      let n = 0
      const result = await clean(sel, store.get('cleanFolders'), (id) => progress({ op: 'clean', current: id, done: n++, total: sel.length }))
      if (result.freedBytes > 0) logActivity({ kind: 'cleaned', title: `${(result.freedBytes / 1024 ** 3).toFixed(2)} GB liberados na limpeza` })
      return { ok: true, result }
    })
  )

  ipcMain.handle('clean:folders', () => store.get('cleanFolders'))
  ipcMain.handle('clean:folders-add', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const pick = await dialog.showOpenDialog(win, { title: 'Escolha uma pasta para limpar', properties: ['openDirectory'] })
    if (pick.canceled || !pick.filePaths[0]) return { ok: false }
    const dir = pick.filePaths[0]
    if (isForbiddenRoot(dir)) return { ok: false, error: 'Essa pasta é do sistema ou guarda seus arquivos pessoais e não pode ser limpa.' }
    store.set('cleanFolders', [...new Set([...store.get('cleanFolders'), dir])])
    return { ok: true, folders: store.get('cleanFolders') }
  })
  ipcMain.handle('clean:folders-remove', (_e, dir: string) => {
    store.set('cleanFolders', store.get('cleanFolders').filter((f) => f !== dir))
    return store.get('cleanFolders')
  })

  // ---- memory ----
  ipcMain.handle('memory:info', () => memoryInfo())
  ipcMain.handle('memory:free', () => exclusive('memory', memFail(BUSY), async () => (isPremium() ? freeMemory() : memFail(PREMIUM))))

  // ---- registry ----
  ipcMain.handle('registry:scan', () => scanRegistry())
  ipcMain.handle('registry:clean', (_e, list: unknown) =>
    exclusive('registry', { ok: false, removed: 0, error: BUSY }, async () =>
      isPremium() ? cleanRegistry(ids(list), registryBackupDir()) : { ok: false, removed: 0, error: PREMIUM }
    )
  )

  // ---- windows apps ----
  ipcMain.handle('apps:appx-list', () => listAppx())
  ipcMain.handle('apps:appx-history', () => appxHistory())
  ipcMain.handle('apps:appx-remove', (_e, list: unknown) =>
    exclusive('appx', { ok: false, error: BUSY }, async () => {
      const sel = ids(list)
      const r = await removeAppx(sel, (name, done) => progress({ op: 'appx-remove', current: name, done, total: sel.length }))
      if (r.done) logActivity({ kind: 'apps-removed', title: `${r.done} app(s) do Windows removido(s)` })
      return r
    })
  )
  ipcMain.handle('apps:appx-restore', (_e, name: string) => exclusive('appx', { ok: false, error: BUSY }, () => restoreAppx(String(name))))

  // ---- programs ----
  ipcMain.handle('apps:programs', () => listPrograms())
  ipcMain.handle('apps:uninstall', (_e, id: string) =>
    exclusive('uninstall', { ok: false, error: BUSY }, async () => {
      progress({ op: 'uninstall', current: String(id), done: 0, total: 1 })
      return uninstallProgram(String(id))
    })
  )
  ipcMain.handle('apps:leftovers', (_e, id: string) => findLeftovers(String(id)))
  ipcMain.handle('apps:leftovers-remove', (_e, list: unknown) => removeLeftovers(ids(list), registryBackupDir()))

  // ---- winget ----
  ipcMain.handle('apps:winget-list', () => listWinget())
  ipcMain.handle('apps:winget-install', (_e, list: unknown) =>
    exclusive('winget', { ok: false, error: BUSY }, async () => {
      const sel = ids(list)
      return installWinget(sel, (id, done) => progress({ op: 'winget', current: id, done, total: sel.length }))
    })
  )
}
