import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'

let tray: Tray | null = null
let getWindow: () => BrowserWindow | null = () => null

export function initTray(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter
}

export function isTrayEnabled(): boolean {
  return tray !== null
}

export function setTrayEnabled(enabled: boolean): void {
  if (!enabled) {
    tray?.destroy()
    tray = null
    return
  }
  if (tray) return
  const icon = nativeImage.createFromPath(join(app.getAppPath(), 'build', 'icon.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('FpsBoost')
  const show = (): void => {
    const w = getWindow()
    if (!w) return
    w.show()
    w.focus()
  }
  tray.on('click', show)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir FpsBoost', click: show },
      { type: 'separator' },
      { label: 'Sair', click: () => app.exit(0) }
    ])
  )
}
