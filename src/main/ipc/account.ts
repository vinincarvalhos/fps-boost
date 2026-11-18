import { ipcMain } from 'electron'
import { activate, deactivate, licenseState, refresh } from '../services/license'
import { checkForUpdates, downloadUpdate, installUpdate, updaterState } from '../services/updater'

export function registerAccountIpc(): void {
  ipcMain.handle('license:status', () => licenseState())
  ipcMain.handle('license:activate', (_e, key: string) => activate(String(key ?? '')))
  ipcMain.handle('license:deactivate', () => deactivate())
  ipcMain.handle('license:refresh', () => refresh())

  ipcMain.handle('updater:state', () => updaterState())
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:download', () => downloadUpdate())
  ipcMain.handle('updater:install', () => installUpdate())
}
