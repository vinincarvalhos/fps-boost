import { BrowserWindow, nativeTheme } from 'electron'
import type { ThemePref } from '@shared/types'
import { store } from './store'

/** Canvas colours from DESIGN.md, used as the window background so there's no flash on open. */
const CANVAS = { light: '#f5f5f7', dark: '#000000' }

export function themePref(): ThemePref {
  const t = store.get('settings').theme
  return t === 'light' || t === 'dark' ? t : 'system'
}

export function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? CANVAS.dark : CANVAS.light
}

/**
 * Electron's themeSource drives `prefers-color-scheme` in the renderer, so the page only has
 * to follow the media query. "system" follows Windows' app mode.
 */
export function applyTheme(pref: ThemePref = themePref()): void {
  nativeTheme.themeSource = pref
  for (const w of BrowserWindow.getAllWindows()) w.setBackgroundColor(windowBackground())
}
