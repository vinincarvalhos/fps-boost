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

export interface Settings {
  autostart: boolean
  tray: boolean
  autoRestorePoint: boolean
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
  'history:list'
] as const
export type InvokeChannel = (typeof INVOKE_CHANNELS)[number]

export const SEND_CHANNELS = ['window:minimize', 'window:maximize', 'window:close'] as const
export type SendChannel = (typeof SEND_CHANNELS)[number]

export interface ActivityEntry {
  kind: 'applied' | 'reverted' | 'restore-point'
  title: string
  at: string
}
