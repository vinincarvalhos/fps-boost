import Store from 'electron-store'
import type { ActivityEntry, AppxRemoved, Game, GameModePrefs, Settings } from '@shared/types'

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
  games: Game[]
  gameModePrefs: Partial<GameModePrefs>
  /** what the running game mode changed, so it can be undone after a crash */
  gameModeRestore: { previousPlan?: string; stoppedServices: string[] } | null
  /** backup of the NVIDIA global profile taken before FpsBoost first changed it */
  gpuBackup: { file: string; at: string } | null
  gpuApplied: { keys: string[]; at: string } | null
  /** PCI instance ids whose MSI mode FpsBoost turned on */
  msiChanged: string[]
  /** USB selective suspend values before FpsBoost turned it off */
  usbSuspendStash: { ac: number; dc: number } | null
}

export const store = new Store<Schema>({
  name: 'fpsboost',
  defaults: {
    settings: { autostart: false, tray: false, autoRestorePoint: true, theme: 'system' },
    tweaks: {},
    firstTweakRestorePointDone: false,
    history: [],
    appxHistory: [],
    cleanFolders: [],
    games: [],
    gameModePrefs: {},
    gameModeRestore: null,
    gpuBackup: null,
    gpuApplied: null,
    msiChanged: [],
    usbSuspendStash: null
  }
})

export function logActivity(entry: Omit<ActivityEntry, 'at'>): void {
  store.set('history', [{ ...entry, at: new Date().toISOString() }, ...store.get('history')].slice(0, 50))
}
