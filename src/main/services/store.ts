import Store from 'electron-store'
import type { ActivityEntry, AppxRemoved, Settings } from '@shared/types'

interface Schema {
  settings: Settings
  /** tweak id -> applied */
  tweaks: Record<string, boolean>
  firstTweakRestorePointDone: boolean
  /** most recent first, capped */
  history: ActivityEntry[]
  /** apps removed by the debloat tool, most recent first */
  appxHistory: AppxRemoved[]
  /** folders the user added to the cleaner */
  cleanFolders: string[]
}

export const store = new Store<Schema>({
  name: 'fpsboost',
  defaults: {
    settings: { autostart: false, tray: false, autoRestorePoint: true },
    tweaks: {},
    firstTweakRestorePointDone: false,
    history: [],
    appxHistory: [],
    cleanFolders: []
  }
})

export function logActivity(entry: Omit<ActivityEntry, 'at'>): void {
  store.set('history', [{ ...entry, at: new Date().toISOString() }, ...store.get('history')].slice(0, 50))
}
