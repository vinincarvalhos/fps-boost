export type Risk = 'safe' | 'caution'
export type Hardware = 'cpu' | 'gpu' | 'any'

export interface TweakMeta {
  id: string
  title: string
  description: string
  details?: string
  confirm?: string
  risk: Risk
  reversible: boolean
  recommended?: boolean
  restart?: boolean
  category: string[]
  hardware?: Hardware
  /** registry keys exported to a .reg backup before applying */
  backupKeys: string[]
  /** true when a detect.ps1 exists, so the UI can show the real system state */
  detectable: boolean
}

export interface TweakResult {
  ok: boolean
  output: string
  error?: string
}

export interface SystemInfo {
  os: { distro: string; release: string; build: string; hostname: string; user: string }
  cpu: { brand: string; manufacturer: string; cores: number; threads: number; speedGhz: number }
  gpus: { model: string; vendor: string; vramMb: number; driver?: string }[]
  memory: { totalGb: number; modules: { sizeGb: number; speedMhz: number; type: string }[] }
  disks: { name: string; type: string; sizeGb: number }[]
  board: { manufacturer: string; model: string }
}

export interface LiveStats {
  cpuLoad: number
  cpuTemp: number | null
  memUsedPct: number
  memUsedGb: number
  gpuLoad: number | null
  gpuTemp: number | null
  /** system drive usage */
  disk: { usedPct: number; freeGb: number; totalGb: number } | null
}

export interface RestorePoint {
  sequence: number
  description: string
  createdAt: string
}

export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  autostart: boolean
  tray: boolean
  autoRestorePoint: boolean
  theme: ThemePref
}

/** Channels the renderer may call with invoke(). Keep in sync with src/main/ipc. */
export const INVOKE_CHANNELS = [
  'system:info',
  'system:live',
  'tweaks:list',
  'tweaks:states',
  'tweaks:apply',
  'tweaks:unapply',
  'backup:list',
  'backup:create',
  'backup:restore',
  'backup:delete-all',
  'backup:registry-list',
  'backup:registry-restore',
  'settings:get',
  'settings:set',
  'app:open-logs',
  'app:restart-explorer',
  'app:reboot',
  'app:reboot-firmware',
  'app:version',
  'app:is-admin',
  'history:list',
  'license:status',
  'license:activate',
  'license:deactivate',
  'license:refresh',
  'updater:state',
  'updater:check',
  'updater:download',
  'updater:install',
  'clean:analyze',
  'clean:run',
  'clean:folders',
  'clean:folders-add',
  'clean:folders-remove',
  'memory:info',
  'memory:free',
  'registry:scan',
  'registry:clean',
  'apps:appx-list',
  'apps:appx-history',
  'apps:appx-remove',
  'apps:appx-restore',
  'apps:programs',
  'apps:uninstall',
  'apps:leftovers',
  'apps:leftovers-remove',
  'apps:winget-list',
  'apps:winget-install',
  'games:list',
  'games:scan',
  'games:add',
  'games:update',
  'games:remove',
  'games:launch',
  'games:exe-candidates',
  'games:setting',
  'games:open-folder',
  'gamemode:state',
  'gamemode:prefs',
  'gamemode:set-prefs',
  'gamemode:activate',
  'gamemode:deactivate',
  'gamemode:services'
] as const
export type InvokeChannel = (typeof INVOKE_CHANNELS)[number]

export const SEND_CHANNELS = ['window:minimize', 'window:maximize', 'window:close'] as const
export type SendChannel = (typeof SEND_CHANNELS)[number]

/** Events the main process pushes to the renderer. */
export const ON_CHANNELS = ['license:changed', 'updater:changed', 'progress', 'gamemode:changed'] as const
export type OnChannel = (typeof ON_CHANNELS)[number]

export type Plan = 'free' | 'premium'

export interface LicenseState {
  plan: Plan
  /**
   * none: no key; active: premium and recently validated; offline: premium on a still-valid
   * token while the server can't be reached; lapsed: token expired offline; error: key refused.
   */
  status: 'none' | 'active' | 'offline' | 'lapsed' | 'error'
  /** key with the middle groups hidden, e.g. FPSB-ABCDE-•••••-•••••-RSTUV */
  maskedKey?: string
  licenseExpiresAt?: string | null
  /** when the app must revalidate online to stay premium */
  validUntil?: string
  machinesUsed?: number
  maxMachines?: number
  message?: string
}

export interface LicenseResult {
  ok: boolean
  state: LicenseState
  error?: string
}

/** Premium-only tweaks: the advanced ones that ask for confirmation. */
export function isPremiumTweak(t: { risk: Risk }): boolean {
  return t.risk === 'caution'
}

export interface UpdaterState {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'dev'
  currentVersion: string
  version?: string
  releaseNotes?: string
  percent?: number
  error?: string
  checkedAt?: string
}

export interface ActivityEntry {
  kind: 'applied' | 'reverted' | 'restore-point' | 'cleaned' | 'apps-removed' | 'gamemode'
  title: string
  at: string
}

// ---------- Etapa 3: limpeza ----------

export interface CleanCategory {
  id: string
  label: string
  description: string
  bytes: number
  files: number
  /** needs admin and the app isn't elevated, so most files can't be read */
  needsAdmin: boolean
  /** not selected by default */
  optIn: boolean
}

export interface CleanResult {
  freedBytes: number
  deleted: number
  /** files in use or without permission */
  skipped: number
  byCategory: Record<string, number>
}

export interface MemoryInfo {
  totalMb: number
  availableMb: number
}

export interface MemoryResult {
  ok: boolean
  beforeMb: number
  afterMb: number
  freedMb: number
  trimmed: number
  standbyPurged: boolean
  error?: string
}

export interface RegistryIssue {
  id: string
  kind: 'startup' | 'app-path' | 'uninstall'
  /** registry key, e.g. HKCU\Software\Microsoft\Windows\CurrentVersion\Run */
  key: string
  /** value name when the issue is a single value (startup entries) */
  value?: string
  name: string
  /** the missing file the entry points to */
  target: string
}

export interface RegistryCleanResult {
  ok: boolean
  removed: number
  backupFile?: string
  error?: string
}

// ---------- Etapa 3: aplicativos ----------

export type AppxPreset = 'basic' | 'recommended' | 'extreme'

export interface AppxEntry {
  name: string
  title: string
  description: string
  /** smallest preset that includes this app; null when it isn't in the curated catalog */
  preset: AppxPreset | null
  installed: boolean
  version?: string
  storeId?: string
}

export interface AppxRemoved {
  name: string
  title: string
  removedAt: string
  storeId?: string
}

export interface ProgramEntry {
  id: string
  name: string
  publisher: string
  version: string
  sizeMb: number
  installDate?: string
  installLocation?: string
}

export interface Leftover {
  id: string
  kind: 'folder' | 'registry'
  path: string
  sizeMb?: number
}

export interface WingetApp {
  id: string
  name: string
  category: string
  description: string
  installed: boolean
}

export interface OpResult {
  ok: boolean
  error?: string
  done?: number
  failed?: { id: string; error: string }[]
}

/** Progress pushed while a long operation runs. */
export interface ProgressEvent {
  op: 'analyze' | 'clean' | 'appx-remove' | 'appx-restore' | 'winget' | 'uninstall'
  current?: string
  done: number
  total: number
}

// ---------- Etapa 4: jogos ----------

export type GameSource = 'steam' | 'epic' | 'gog' | 'ubisoft' | 'manual'

export interface GameSettings {
  /** Image File Execution Options: CPU priority High every time the exe starts */
  highPriority: boolean
  /** Graphics settings: always use the high-performance (dedicated) GPU */
  gpuHigh: boolean
  /** Compatibility flag: disable fullscreen optimizations */
  noFso: boolean
}

export interface Game {
  id: string
  name: string
  source: GameSource
  installDir: string
  /** main executable, used for per-game settings and launching manual games */
  exe?: string
  launchUri?: string
  steamAppId?: number
  /** Steam app id used for the cover art (same as steamAppId for Steam games) */
  coverAppId?: number | null
  sizeGb?: number
  hidden?: boolean
  settings: GameSettings
}

export interface GameModePrefs {
  autoActivate: boolean
  powerPlan: boolean
  timerResolution: boolean
  freeRam: boolean
  raisePriority: boolean
  stopServices: boolean
  services: string[]
}

export interface GameModeState {
  active: boolean
  /** true when started by the user instead of by detecting a game */
  manual: boolean
  game?: { id: string; name: string }
  since?: string
  applied: string[]
  error?: string
}
