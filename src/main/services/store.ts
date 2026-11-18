import Store from 'electron-store'
import type { Settings } from '@shared/types'

interface Schema {
  settings: Settings
  /** tweak id -> applied */
  tweaks: Record<string, boolean>
  firstTweakRestorePointDone: boolean
}

export const store = new Store<Schema>({
  name: 'fpsboost',
  defaults: {
    settings: { autostart: false, tray: false, autoRestorePoint: true },
    tweaks: {},
    firstTweakRestorePointDone: false
  }
})
