import { app, ipcMain, shell } from 'electron'
import { dirname } from 'node:path'
import log from 'electron-log/main'
import type { Settings } from '@shared/types'
import { runPs } from '../services/powershell'
import { store } from '../services/store'
import { setTrayEnabled } from '../tray'
import { applyGlass, applyTheme, glassOn, glassSupported, windowsTransparency } from '../services/theme'

function applyAutostart(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}

export function registerAppIpc(): void {
  ipcMain.handle('settings:get', () => store.get('settings'))

  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const next = { ...store.get('settings'), ...patch }
    store.set('settings', next)
    if ('autostart' in patch) applyAutostart(next.autostart)
    if ('tray' in patch) setTrayEnabled(next.tray)
    if ('theme' in patch) applyTheme(next.theme)
    if ('translucent' in patch) applyGlass()
    return next
  })

  ipcMain.handle('app:open-logs', () => shell.openPath(dirname(log.transports.file.getFile().path)))
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:glass', () => glassOn())
  ipcMain.handle('app:glass-info', async () => ({ supported: glassSupported(), windowsTransparency: await windowsTransparency() }))
  ipcMain.handle('history:list', () => store.get('history'))
  ipcMain.handle('app:is-admin', async () => (await runPs('([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)')).stdout === 'True')
  ipcMain.handle('app:restart-explorer', async () => {
    const res = await runPs('Stop-Process -Name explorer -Force; Start-Sleep -Milliseconds 800; if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer }')
    return { ok: res.code === 0, error: res.stderr }
  })
  ipcMain.handle('app:reboot', () => runPs('shutdown /r /t 5 /c "FpsBoost: reiniciando para concluir os ajustes"'))
  ipcMain.handle('app:reboot-firmware', async () => {
    const res = await runPs('shutdown /r /fw /t 5')
    return { ok: res.code === 0, error: res.stderr || undefined }
  })
}
