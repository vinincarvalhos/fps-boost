import Store from 'electron-store'
import type { ActivityEntry, Settings } from '@shared/types'

interface Schema {
  settings: Settings
  /** tweak id -> applied */
  tweaks: Record<string, boolean>
  firstTweakRestorePointDone: boolean
  /** most recent first, capped */
  history: ActivityEntry[]
}

export const store = new Store<Schema>({
  name: 'fpsboost',
  defaults: {
    settings: { autostart: false, tray: false, autoRestorePoint: true },
    tweaks: {},
    firstTweakRestorePointDone: false,
    history: []
  }
})

export function logActivity(entry: Omit<ActivityEntry, 'at'>): void {
  store.set('history', [{ ...entry, at: new Date().toISOString() }, ...store.get('history')].slice(0, 50))
}
