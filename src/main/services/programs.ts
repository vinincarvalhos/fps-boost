import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Leftover, OpResult, ProgramEntry } from '@shared/types'
import { isForbiddenRoot } from './cleaner'
import { runPs, runPsJson } from './powershell'

interface RawProgram {
  key: string
  name: string
  publisher: string
  version: string
  size: number
  date: string
  location: string
  uninstall: string
  quiet: string
}

const UNINSTALL_KEYS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
]
const q = (s: string) => s.replace(/'/g, "''")
const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16)

let programs = new Map<string, RawProgram>()

export async function listPrograms(): Promise<ProgramEntry[]> {
  const raw = await runPsJson<RawProgram | RawProgram[]>(
    `foreach ($k in @(${UNINSTALL_KEYS.map((k) => `'${k}'`).join(',')})) {
  Get-ChildItem -Path "Registry::$k" -ErrorAction SilentlyContinue | % {
    $n = $_.GetValue('DisplayName'); $u = $_.GetValue('UninstallString')
    if ($n -and $u -and -not $_.GetValue('SystemComponent') -and -not $_.GetValue('ParentKeyName') -and ($_.GetValue('ReleaseType') -notin 'Update','Hotfix','Security Update')) {
      [pscustomobject]@{ key = $_.Name; name = [string]$n; publisher = [string]$_.GetValue('Publisher'); version = [string]$_.GetValue('DisplayVersion');
        size = [int64]($_.GetValue('EstimatedSize')); date = [string]$_.GetValue('InstallDate'); location = [string]$_.GetValue('InstallLocation');
        uninstall = [string]$u; quiet = [string]$_.GetValue('QuietUninstallString') }
    }
  }
}`,
    60_000
  )
  const list = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
  // the same program is often registered in more than one hive
  const seen = new Set<string>()
  programs = new Map()
  for (const p of list) {
    const dedupe = `${p.name}|${p.version}`.toLowerCase()
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    programs.set(hash(p.key), p)
  }
  return [...programs.entries()]
    .map(([id, p]) => ({
      id,
      name: p.name.trim(),
      publisher: p.publisher.trim(),
      version: p.version,
      sizeMb: Math.round((p.size || 0) / 1024),
      installDate: /^\d{8}$/.test(p.date) ? `${p.date.slice(0, 4)}-${p.date.slice(4, 6)}-${p.date.slice(6, 8)}` : undefined,
      installLocation: p.location || undefined
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** msiexec /I{GUID} opens the repair/modify UI; /X{GUID} uninstalls. */
export function normalizeUninstall(cmd: string): string {
  return cmd.replace(/msiexec(\.exe)?\s+\/i\s*(\{[0-9A-F-]+\})/i, 'MsiExec.exe /X$2')
}

const lastUninstalled = new Map<string, RawProgram>()

/** Runs the program's own uninstaller and waits for it to close. */
export async function uninstallProgram(id: string): Promise<OpResult> {
  const p = programs.get(id)
  if (!p) return { ok: false, error: 'Programa não encontrado. Atualize a lista.' }
  lastUninstalled.set(id, p)
  const cmd = normalizeUninstall(p.uninstall)
  const code = await new Promise<number>((resolve) => {
    const child = spawn(cmd, { shell: true, windowsHide: false })
    const timer = setTimeout(() => resolve(-2), 30 * 60_000)
    child.on('error', () => resolve(-1))
    child.on('exit', (c) => {
      clearTimeout(timer)
      resolve(c ?? 0)
    })
  })
  // 1605 = MSI "not installed"; 3010 = success, restart required
  if (code === 0 || code === 3010 || code === 1605) return { ok: true, done: 1 }
  if (code === 1602) return { ok: false, error: 'Desinstalação cancelada.' }
  return { ok: false, error: `O desinstalador terminou com código ${code}.` }
}

// ---------- leftovers ----------

/** Lowercase, without versions, architecture tags and punctuation: "Foo Bar 2.1 (x64)" → "foo bar". */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ') // "_" counts as a word character and would hide "v12" from \b
    .replace(/\((x64|x86|64-bit|32-bit|amd64|arm64)\)|\b(x64|x86|64-bit|32-bit|amd64|arm64)\b/g, ' ')
    .replace(/\bv?\d+([._]\d+)*\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const GENERIC = new Set(['microsoft', 'windows', 'common files', 'microsoft corporation', 'intel', 'nvidia', 'amd', 'program', 'programs', 'app', 'apps', 'temp', 'packages', 'system'])

/**
 * Whether a folder name looks like it belongs to the program. Exact normalized match only,
 * so "Steam" never matches "SteamVR" or "Steam Library".
 */
export function matchesProgram(dirName: string, programName: string): boolean {
  const d = normalizeName(dirName)
  const n = normalizeName(programName)
  if (n.length < 4 || GENERIC.has(n) || GENERIC.has(d)) return false
  return d === n || d.replace(/ /g, '') === n.replace(/ /g, '')
}

let leftovers = new Map<string, Leftover>()

function folderRoots(): string[] {
  const local = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
  return [
    process.env.ProgramFiles ?? 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    process.env.ProgramData ?? 'C:\\ProgramData',
    process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
    local,
    join(local, 'Programs')
  ]
}

async function folderSizeMb(dir: string): Promise<number> {
  const r = await runPsJson<number>(
    `[math]::Round(((Get-ChildItem -LiteralPath '${q(dir)}' -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) / 1MB, 1)`,
    60_000
  )
  return r ?? 0
}

/** Finds folders and registry keys left behind by a program that is no longer installed. */
export async function findLeftovers(id: string): Promise<Leftover[]> {
  const p = lastUninstalled.get(id) ?? programs.get(id)
  if (!p) return []
  const still = (await listPrograms()).some((x) => x.name === p.name.trim())
  if (still) return [] // the uninstaller hasn't finished, or was cancelled
  const installedNames = [...programs.values()].map((x) => x.name)

  const found: Leftover[] = []
  const addFolder = async (path: string) => {
    if (!existsSync(path) || isForbiddenRoot(path) || found.some((f) => f.path.toLowerCase() === path.toLowerCase())) return
    // a folder that another installed program uses is not a leftover
    if (installedNames.some((n) => n !== p.name && matchesProgram(path.split('\\').pop() ?? '', n))) return
    found.push({ id: hash(`f|${path}`), kind: 'folder', path, sizeMb: await folderSizeMb(path) })
  }

  if (p.location) await addFolder(p.location.replace(/[\\/]+$/, '').replace(/^"|"$/g, ''))
  for (const root of folderRoots()) {
    let entries: string[] = []
    try {
      entries = readdirSync(root)
    } catch {
      continue
    }
    for (const e of entries) {
      if (matchesProgram(e, p.name)) await addFolder(join(root, e))
      else if (p.publisher && matchesProgram(e, p.publisher)) {
        // Publisher\Program layout
        try {
          for (const sub of readdirSync(join(root, e))) if (matchesProgram(sub, p.name)) await addFolder(join(root, e, sub))
        } catch {
          /* unreadable */
        }
      }
    }
  }

  const keys = [
    ...(p.publisher ? [`HKCU\\Software\\${p.publisher}\\${p.name}`, `HKLM\\SOFTWARE\\${p.publisher}\\${p.name}`, `HKLM\\SOFTWARE\\WOW6432Node\\${p.publisher}\\${p.name}`] : []),
    `HKCU\\Software\\${p.name}`,
    `HKLM\\SOFTWARE\\${p.name}`,
    `HKLM\\SOFTWARE\\WOW6432Node\\${p.name}`
  ].filter((k) => normalizeName(k.split('\\').pop() ?? '').length >= 4 && !/\\(Microsoft|Classes|Policies|Wow6432Node)$/i.test(k))
  const existing = await runPsJson<string | string[]>(`@(${keys.map((k) => `'${q(k)}'`).join(',')}) | ? { Test-Path "Registry::$_" }`)
  for (const k of existing == null ? [] : Array.isArray(existing) ? existing : [existing]) found.push({ id: hash(`r|${k}`), kind: 'registry', path: k })

  leftovers = new Map(found.map((f) => [f.id, f]))
  return found
}

/** Folders go to the Recycle Bin; registry keys are exported to a .reg backup first. */
export async function removeLeftovers(ids: string[], backupDir: string): Promise<OpResult> {
  const failed: { id: string; error: string }[] = []
  let done = 0
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  for (const [n, id] of ids.entries()) {
    const l = leftovers.get(id)
    if (!l) continue
    const r =
      l.kind === 'folder'
        ? await runPs(
            `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${q(l.path)}', 'OnlyErrorDialogs', 'SendToRecycleBin')`,
            300_000
          )
        : await runPs(
            `reg export '${q(l.path)}' '${q(join(backupDir, `sobras__${stamp}__${n}.reg`))}' /y | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'backup falhou' }; Remove-Item -Path 'Registry::${q(l.path)}' -Recurse`
          )
    if (r.code === 0) {
      done++
      leftovers.delete(id)
    } else failed.push({ id, error: r.stderr.split('\n')[0] || 'Falha ao remover' })
  }
  return { ok: failed.length === 0, done, failed }
}
