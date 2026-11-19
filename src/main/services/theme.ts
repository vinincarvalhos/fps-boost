import { BrowserWindow, nativeTheme } from 'electron'
import { execFile } from 'node:child_process'
import os from 'node:os'
import type { ThemePref } from '@shared/types'
import { store } from './store'

/** Canvas colours from DESIGN.md, used as the window background so there's no flash on open. */
const CANVAS = { light: '#f5f5f7', dark: '#000000' }

export function themePref(): ThemePref {
  const t = store.get('settings').theme
  return t === 'light' || t === 'dark' ? t : 'system'
}

/** Acrylic needs Windows 11 22H2 (build 22621) or newer. */
export function glassSupported(): boolean {
  if (process.platform !== 'win32') return false
  const build = Number(os.release().split('.')[2] ?? 0)
  return build >= 22621
}

/** Whether the window is translucent right now: the user's setting (on by default) and Windows support. */
export function glassOn(): boolean {
  return glassSupported() && store.get('settings').translucent !== false
}

/**
 * Windows' own "Transparency effects" switch (Personalização > Cores). When it is off, Windows
 * paints the acrylic as solid grey, so the app can't look translucent whatever its colours are.
 */
export function windowsTransparency(): Promise<boolean> {
  return new Promise((resolve) =>
    execFile('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', '/v', 'EnableTransparency'], { windowsHide: true }, (err, out) =>
      resolve(err ? true : !/EnableTransparency\s+REG_DWORD\s+0x0\s*$/im.test(out))
    )
  )
}

/** Fully transparent when translucent, so the acrylic shows through; the canvas colour otherwise. */
export function windowBackground(): string {
  if (glassOn()) return '#00000000'
  return nativeTheme.shouldUseDarkColors ? CANVAS.dark : CANVAS.light
}

/** Turns the Windows acrylic material on or off for every window (also used when the setting changes). */
export function applyGlass(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.setBackgroundMaterial(glassOn() ? 'acrylic' : 'none')
    w.setBackgroundColor(windowBackground())
  }
}

/**
 * Electron's themeSource drives `prefers-color-scheme` in the renderer, so the page only has
 * to follow the media query. "system" follows Windows' app mode.
 */
export function applyTheme(pref: ThemePref = themePref()): void {
  nativeTheme.themeSource = pref
  for (const w of BrowserWindow.getAllWindows()) w.setBackgroundColor(windowBackground())
}
