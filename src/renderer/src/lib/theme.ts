import { create } from 'zustand'
import type { Settings, ThemePref } from '@shared/types'

/**
 * The main process sets Electron's themeSource from the user's choice, so
 * `prefers-color-scheme` already reflects it here; the page just mirrors it on <html>.
 */
export function followColorScheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => (document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light')
  apply()
  mq.addEventListener('change', apply)
}

interface ThemeState {
  pref: ThemePref
  load: () => Promise<void>
  set: (pref: ThemePref) => Promise<void>
}

export const useTheme = create<ThemeState>((set) => ({
  pref: 'system',
  load: async () => {
    const s = await window.fps.invoke<Settings>('settings:get')
    set({ pref: s.theme ?? 'system' })
  },
  set: async (pref) => {
    set({ pref })
    await window.fps.invoke('settings:set', { theme: pref })
  }
}))

export const isDark = () => document.documentElement.dataset.theme === 'dark'
