import { existsSync, readdirSync, type Dirent } from 'node:fs'
import { lstat, readdir, rm, rmdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path'
import type { CleanCategory, CleanResult } from '@shared/types'
import { runPs, runPsJson } from './powershell'

const env = (name: string, fallback = '') => process.env[name] ?? fallback
const LOCAL = () => env('LOCALAPPDATA', join(homedir(), 'AppData', 'Local'))
const ROAMING = () => env('APPDATA', join(homedir(), 'AppData', 'Roaming'))
const WIN = () => env('SystemRoot', 'C:\\Windows')
const PROGRAMDATA = () => env('ProgramData', 'C:\\ProgramData')

export interface CategoryDef {
  id: string
  label: string
  description: string
  /** directories whose contents are cleaned (the directory itself is kept) */
  roots: () => string[]
  /** only files matching this (by file name) are counted/removed */
  match?: RegExp
  /** skip files modified more recently than this, so running programs keep their working files */
  minAgeHours?: number
  needsAdmin?: boolean
  /** cleaned by a PowerShell command instead of walking folders */
  special?: 'recycle-bin'
  /** off by default in the UI */
  optIn?: boolean
}

/** Every `Profile*`/`Default` folder inside a Chromium "User Data" directory. */
function chromiumProfiles(userData: string, subdirs: string[]): string[] {
  if (!existsSync(userData)) return []
  const out: string[] = []
  try {
    for (const d of readdirSync(userData, { withFileTypes: true })) {
      if (!d.isDirectory() || !(d.name === 'Default' || d.name.startsWith('Profile') || d.name === 'Guest Profile')) continue
      for (const s of subdirs) out.push(join(userData, d.name, s))
    }
  } catch {
    /* unreadable profile dir */
  }
  return out
}

function firefoxProfiles(): string[] {
  const base = join(LOCAL(), 'Mozilla', 'Firefox', 'Profiles')
  if (!existsSync(base)) return []
  try {
    return readdirSync(base).map((p) => join(base, p, 'cache2'))
  } catch {
    return []
  }
}

const CHROMIUM_CACHE = ['Cache', 'Code Cache', 'GPUCache', 'Service Worker\\CacheStorage']

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'user-temp',
    label: 'Arquivos temporários do usuário',
    description: 'Arquivos que programas e instaladores deixam para trás na sua pasta Temp.',
    roots: () => [env('TEMP', join(LOCAL(), 'Temp'))],
    minAgeHours: 2
  },
  {
    id: 'windows-temp',
    label: 'Arquivos temporários do Windows',
    description: 'A pasta Temp do próprio Windows.',
    roots: () => [join(WIN(), 'Temp')],
    minAgeHours: 2,
    needsAdmin: true
  },
  {
    id: 'windows-update',
    label: 'Cache do Windows Update',
    description: 'Instaladores de atualizações já aplicadas. O Windows baixa de novo se precisar.',
    roots: () => [join(WIN(), 'SoftwareDistribution', 'Download')],
    needsAdmin: true
  },
  {
    id: 'delivery-optimization',
    label: 'Otimização de Entrega',
    description: 'Partes de atualizações guardadas para compartilhar com outros PCs.',
    roots: () => [join(WIN(), 'ServiceProfiles', 'NetworkService', 'AppData', 'Local', 'Microsoft', 'Windows', 'DeliveryOptimization', 'Cache')],
    needsAdmin: true
  },
  {
    id: 'browser-cache',
    label: 'Cache dos navegadores',
    description: 'Imagens e scripts guardados por Chrome, Edge, Brave, Opera, Vivaldi e Firefox. Logins e históricos não são tocados.',
    roots: () => [
      ...chromiumProfiles(join(LOCAL(), 'Google', 'Chrome', 'User Data'), CHROMIUM_CACHE),
      ...chromiumProfiles(join(LOCAL(), 'Microsoft', 'Edge', 'User Data'), CHROMIUM_CACHE),
      ...chromiumProfiles(join(LOCAL(), 'BraveSoftware', 'Brave-Browser', 'User Data'), CHROMIUM_CACHE),
      ...chromiumProfiles(join(LOCAL(), 'Vivaldi', 'User Data'), CHROMIUM_CACHE),
      join(LOCAL(), 'Opera Software', 'Opera Stable', 'Cache'),
      join(LOCAL(), 'Opera Software', 'Opera GX Stable', 'Cache'),
      ...firefoxProfiles()
    ]
  },
  {
    id: 'shader-cache',
    label: 'Cache de shaders da GPU',
    description: 'Shaders compilados pelo driver de vídeo. Limpar resolve gráficos corrompidos, mas os jogos podem engasgar na primeira abertura enquanto recompilam.',
    roots: () => [
      join(LOCAL(), 'NVIDIA', 'DXCache'),
      join(LOCAL(), 'NVIDIA', 'GLCache'),
      join(LOCAL(), 'AMD', 'DxCache'),
      join(LOCAL(), 'AMD', 'DxcCache'),
      join(LOCAL(), 'AMD', 'GLCache'),
      join(LOCAL(), 'AMD', 'VkCache'),
      join(LOCAL(), 'D3DSCache'),
      join(LOCAL(), 'Intel', 'ShaderCache')
    ],
    optIn: true
  },
  {
    id: 'app-caches',
    label: 'Cache de apps',
    description: 'Cache do Discord, da Steam (navegador interno), do Spotify e da Epic Games.',
    roots: () => [
      join(ROAMING(), 'discord', 'Cache'),
      join(ROAMING(), 'discord', 'Code Cache'),
      join(ROAMING(), 'discord', 'GPUCache'),
      join(LOCAL(), 'Steam', 'htmlcache'),
      join(LOCAL(), 'Spotify', 'Data'),
      join(LOCAL(), 'EpicGamesLauncher', 'Saved', 'webcache'),
      join(LOCAL(), 'EpicGamesLauncher', 'Saved', 'webcache_4147'),
      join(LOCAL(), 'EpicGamesLauncher', 'Saved', 'webcache_4430')
    ]
  },
  {
    id: 'thumbnails',
    label: 'Miniaturas do Explorador',
    description: 'Prévias de imagens e vídeos. O Explorador recria conforme você abre as pastas.',
    roots: () => [join(LOCAL(), 'Microsoft', 'Windows', 'Explorer')],
    match: /^(thumbcache|iconcache)_.*\.db$/i
  },
  {
    id: 'crash-dumps',
    label: 'Relatórios e despejos de erro',
    description: 'Arquivos gerados quando um programa ou o Windows trava. Só são úteis para diagnosticar falhas.',
    roots: () => [
      join(LOCAL(), 'CrashDumps'),
      join(PROGRAMDATA(), 'Microsoft', 'Windows', 'WER', 'ReportArchive'),
      join(PROGRAMDATA(), 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
      join(WIN(), 'Minidump'),
      join(WIN(), 'LiveKernelReports')
    ],
    needsAdmin: true
  },
  {
    id: 'windows-logs',
    label: 'Logs antigos do Windows',
    description: 'Registros de instalação e manutenção com mais de 7 dias.',
    roots: () => [join(WIN(), 'Logs')],
    match: /\.(log|etl|cab)$/i,
    minAgeHours: 24 * 7,
    needsAdmin: true
  },
  {
    id: 'recycle-bin',
    label: 'Lixeira',
    description: 'Arquivos que você já apagou. Depois de limpar, não dá para recuperá-los.',
    roots: () => [],
    special: 'recycle-bin',
    optIn: true
  }
]

// ---------- safety ----------

/** Folders that must never be a cleaning root themselves (their contents would be someone's system or data). */
export function isForbiddenRoot(p: string): boolean {
  if (!isAbsolute(p)) return true
  const full = resolve(p).replace(/[\\/]+$/, '').toLowerCase()
  const { root } = parse(full)
  if (full === root.replace(/[\\/]+$/, '').toLowerCase() || full.length <= 3) return true // drive root
  const forbidden = [
    WIN(),
    join(WIN(), 'System32'),
    env('ProgramFiles', 'C:\\Program Files'),
    env('ProgramFiles(x86)', 'C:\\Program Files (x86)'),
    PROGRAMDATA(),
    homedir(),
    join(homedir(), 'Documents'),
    join(homedir(), 'Desktop'),
    join(homedir(), 'Pictures'),
    join(homedir(), 'Videos'),
    join(homedir(), 'Music'),
    join(homedir(), 'Downloads'),
    LOCAL(),
    ROAMING(),
    'C:\\Users'
  ].map((f) => resolve(f).toLowerCase())
  if (forbidden.includes(full)) return true
  // anything inside System32 is off limits
  const sys = join(WIN(), 'System32').toLowerCase()
  return full.startsWith(sys + sep)
}

export function isInside(child: string, root: string): boolean {
  const rel = relative(root, child)
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
}

// ---------- walking ----------

interface WalkOpts {
  match?: RegExp
  minAgeHours?: number
}

/** Visits regular files under `root` without following links/junctions. */
async function walk(root: string, opts: WalkOpts, onFile: (path: string, size: number) => Promise<void> | void): Promise<void> {
  const cutoff = opts.minAgeHours ? Date.now() - opts.minAgeHours * 3600_000 : Infinity
  const visit = async (dir: string) => {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // no access / vanished
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isSymbolicLink()) continue
      if (e.isDirectory()) {
        await visit(p)
        continue
      }
      if (!e.isFile()) continue
      if (opts.match && !opts.match.test(e.name)) continue
      try {
        const st = await lstat(p)
        if (st.mtimeMs > cutoff) continue
        await onFile(p, st.size)
      } catch {
        /* vanished */
      }
    }
  }
  try {
    const st = await lstat(root)
    if (!st.isDirectory() || st.isSymbolicLink()) return
  } catch {
    return
  }
  await visit(root)
}

/** Removes empty directories under root (deepest first), keeping root itself. */
async function pruneEmpty(root: string): Promise<void> {
  const visit = async (dir: string): Promise<boolean> => {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return false
    }
    let empty = true
    for (const e of entries) {
      if (e.isDirectory() && !e.isSymbolicLink()) {
        const sub = join(dir, e.name)
        if (await visit(sub)) await rmdir(sub).catch(() => (empty = false))
        else empty = false
      } else empty = false
    }
    return empty
  }
  await visit(root)
}

// ---------- recycle bin ----------

async function recycleBinSize(): Promise<{ bytes: number; files: number }> {
  const r = await runPsJson<{ bytes: number; files: number }>(
    // FolderItem.Size is 0 for deleted folders, so folders are measured on disk
    `$s = (New-Object -ComObject Shell.Application).NameSpace(10); $items = @($s.Items()); $total = [int64]0
foreach ($i in $items) {
  if ($i.IsFolder) { $total += [int64]((Get-ChildItem -LiteralPath $i.Path -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) }
  else { $total += [int64]$i.ExtendedProperty('System.Size') }
}
[pscustomobject]@{ bytes = $total; files = $items.Count }`
  )
  return r ?? { bytes: 0, files: 0 }
}

// ---------- public API ----------

export interface Target {
  def: CategoryDef
  roots: string[]
}

export function targets(customFolders: string[]): Target[] {
  const list: Target[] = CATEGORIES.map((def) => ({ def, roots: def.roots().filter((r) => !isForbiddenRoot(r)) }))
  const custom = customFolders.filter((f) => !isForbiddenRoot(f))
  if (custom.length)
    list.push({
      def: { id: 'custom', label: 'Pastas personalizadas', description: 'Pastas que você adicionou. Todo o conteúdo é apagado.', roots: () => custom },
      roots: custom
    })
  return list
}

export async function analyze(customFolders: string[], isAdmin: boolean, onProgress?: (id: string) => void): Promise<CleanCategory[]> {
  const out: CleanCategory[] = []
  for (const { def, roots } of targets(customFolders)) {
    onProgress?.(def.id)
    let bytes = 0
    let files = 0
    if (def.special === 'recycle-bin') ({ bytes, files } = await recycleBinSize())
    else
      for (const r of roots)
        await walk(r, def, (_p, size) => {
          bytes += size
          files++
        })
    out.push({
      id: def.id,
      label: def.label,
      description: def.description,
      bytes,
      files,
      needsAdmin: !!def.needsAdmin && !isAdmin,
      optIn: !!def.optIn
    })
  }
  return out
}

/** Deletes files of the given categories. Locked files are skipped and counted. */
export async function clean(ids: string[], customFolders: string[], onProgress?: (id: string) => void): Promise<CleanResult> {
  const result: CleanResult = { freedBytes: 0, deleted: 0, skipped: 0, byCategory: {} }
  for (const { def, roots } of targets(customFolders)) {
    if (!ids.includes(def.id)) continue
    onProgress?.(def.id)
    let freed = 0
    if (def.special === 'recycle-bin') {
      const before = await recycleBinSize()
      const r = await runPs('Clear-RecycleBin -Force -ErrorAction SilentlyContinue')
      if (r.code === 0) {
        freed = before.bytes
        result.deleted += before.files
      }
    } else {
      for (const root of roots) {
        await walk(root, def, async (p, size) => {
          if (!isInside(p, root)) return
          try {
            await rm(p, { force: true })
            freed += size
            result.deleted++
          } catch {
            result.skipped++ // in use
          }
        })
        await pruneEmpty(root)
      }
    }
    result.freedBytes += freed
    result.byCategory[def.id] = freed
  }
  return result
}

/** Exposed for tests. */
export const _internal = { walk, pruneEmpty }
