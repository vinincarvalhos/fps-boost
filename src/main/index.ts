import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import log from 'electron-log/main'
import { registerAppIpc } from './ipc/app'
import { registerBackupIpc } from './ipc/backup'
import { registerSystemIpc } from './ipc/system'
import { registerTweakIpc } from './ipc/tweaks'
import { registerAccountIpc } from './ipc/account'
import { registerPhase3Ipc } from './ipc/phase3'
import { registerGamesIpc } from './ipc/games'
import { initGameMode, shutdownGameMode } from './services/gamemode'
import { initLicense } from './services/license'
import { initUpdater } from './services/updater'
import { store } from './services/store'
import { applyTheme, windowBackground } from './services/theme'
import { initTray, isTrayEnabled, setTrayEnabled } from './tray'

// Dev only: lets tools capture screenshots over the DevTools protocol.
if (!app.isPackaged && process.env.FPS_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.FPS_DEBUG_PORT)

log.initialize()
log.info('FpsBoost iniciando', app.getVersion())

let win: BrowserWindow | null = null
/** set once the app is really exiting, so closing the window no longer hides it to the tray */
let quitting = false

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    show: false,
    backgroundColor: windowBackground(),
    title: 'FpsBoost',
    icon: join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) win?.show()
  })

  // Closing hides to tray when the tray is on.
  win.on('close', (e) => {
    if (isTrayEnabled() && !quitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('br.fpsboost.app')
    ipcMain.on('window:minimize', () => win?.minimize())
    ipcMain.on('window:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
    ipcMain.on('window:close', () => win?.close())

    applyTheme() // before the window exists, so it opens in the right colours
    registerSystemIpc()
    registerTweakIpc()
    registerBackupIpc()
    registerAppIpc()
    registerAccountIpc()
    registerPhase3Ipc()
    registerGamesIpc()
    initGameMode().catch((err) => log.error('[gamemode] init', err))
    initLicense().catch((err) => log.error('[license] init', err))
    initUpdater()

    createWindow()
    initTray(() => win)
    if (store.get('settings').tray) setTrayEnabled(true)
  })

  app.on('window-all-closed', () => app.quit())

  // put power plan, services and timer back before exiting
  let shuttingDown = false
  app.on('before-quit', (e) => {
    quitting = true
    if (shuttingDown) return
    e.preventDefault()
    shuttingDown = true
    shutdownGameMode()
      .catch((err) => log.warn('[gamemode] shutdown', err))
      .finally(() => app.quit())
  })
}
