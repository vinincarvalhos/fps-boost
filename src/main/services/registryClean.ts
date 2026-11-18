import { lstatSync } from 'node:fs'

/**
 * File existence that also counts app execution aliases (…\WindowsApps\*.exe): they are
 * reparse points that stat() can't follow, so existsSync() wrongly says they're missing.
 */
export function fileExists(p: string): boolean {
  if (/\\WindowsApps\\/i.test(p)) return true
  try {
    lstatSync(p)
    return true
  } catch {
    return false
  }
}
import { createHash } from 'node:crypto'
import { isAbsolute, join } from 'node:path'
import type { RegistryCleanResult, RegistryIssue } from '@shared/types'
import { runPs, runPsJson } from './powershell'

/**
 * Pulls the executable path out of a command line:
 * `"C:\x\a.exe" /arg` → C:\x\a.exe, `C:\x y\a.exe -s` → C:\x y\a.exe, `%ProgramFiles%\a.exe` expanded.
 * Returns null for bare names (msiexec.exe, rundll32 …) that are resolved through PATH.
 */
export function exeFromCommand(cmd: string, env: Record<string, string | undefined> = process.env): string | null {
  let s = (cmd ?? '').trim().replace(/%([^%]+)%/g, (m, v: string) => {
    const key = Object.keys(env).find((k) => k.toLowerCase() === v.toLowerCase())
    return key ? (env[key] ?? m) : m
  })
  if (!s) return null
  if (s.startsWith('"')) s = s.slice(1, s.indexOf('"', 1) > 0 ? s.indexOf('"', 1) : undefined)
  else {
    const m = /^(.+?\.(exe|com|bat|cmd|lnk))(?=\s|,|$)/i.exec(s)
    s = m ? m[1] : s.split(/\s+/)[0]
  }
  s = s.replace(/,\s*-?\d+$/, '') // DisplayIcon style "file.exe,0"
  if (!isAbsolute(s) || /^[a-z]:$/i.test(s)) return null
  return s
}

interface RawRun {
  key: string
  value: string
  data: string
}
interface RawAppPath {
  key: string
  name: string
  data: string
}
interface RawUninstall {
  key: string
  name: string
  uninstall: string
  location: string
}

const RUN_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
]
const APP_PATH_KEYS = ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths']
const UNINSTALL_KEYS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
]

const arr = <T>(x: T | T[] | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x])
const id = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16)
const q = (s: string) => s.replace(/'/g, "''")

/** Decides which raw entries point to files that are gone. Pure, for tests. */
export function findIssues(
  run: RawRun[],
  appPaths: RawAppPath[],
  uninstall: RawUninstall[],
  exists: (p: string) => boolean = fileExists
): RegistryIssue[] {
  const out: RegistryIssue[] = []
  for (const r of run) {
    const exe = exeFromCommand(r.data)
    if (exe && !exists(exe)) out.push({ id: id(`run|${r.key}|${r.value}`), kind: 'startup', key: r.key, value: r.value, name: r.value, target: exe })
  }
  for (const a of appPaths) {
    const exe = exeFromCommand(a.data)
    if (exe && !exists(exe)) out.push({ id: id(`app|${a.key}`), kind: 'app-path', key: a.key, name: a.name, target: exe })
  }
  for (const u of uninstall) {
    if (/msiexec/i.test(u.uninstall)) continue // MSI entries are managed by Windows Installer
    const exe = exeFromCommand(u.uninstall)
    const locGone = !u.location || !exists(u.location)
    if (exe && !exists(exe) && locGone) out.push({ id: id(`un|${u.key}`), kind: 'uninstall', key: u.key, name: u.name, target: exe })
  }
  return out
}

let lastScan = new Map<string, RegistryIssue>()

export async function scanRegistry(): Promise<RegistryIssue[]> {
  const run = await runPsJson<RawRun | RawRun[]>(`
foreach ($k in @(${RUN_KEYS.map((k) => `'${k}'`).join(',')})) {
  $p = Get-ItemProperty -Path "Registry::$k" -ErrorAction SilentlyContinue
  if ($p) { $p.PSObject.Properties | ? { $_.Name -notlike 'PS*' -and $_.Value -is [string] } | % { [pscustomobject]@{ key = $k; value = $_.Name; data = $_.Value } } }
}`)
  const appPaths = await runPsJson<RawAppPath | RawAppPath[]>(`
foreach ($k in @(${APP_PATH_KEYS.map((k) => `'${k}'`).join(',')})) {
  Get-ChildItem -Path "Registry::$k" -ErrorAction SilentlyContinue | % {
    $d = $_.GetValue('')
    if ($d) { [pscustomobject]@{ key = $_.Name; name = $_.PSChildName; data = [string]$d } }
  }
}`)
  const uninstall = await runPsJson<RawUninstall | RawUninstall[]>(`
foreach ($k in @(${UNINSTALL_KEYS.map((k) => `'${k}'`).join(',')})) {
  Get-ChildItem -Path "Registry::$k" -ErrorAction SilentlyContinue | % {
    $n = $_.GetValue('DisplayName'); $u = $_.GetValue('UninstallString')
    if ($n -and $u -and -not $_.GetValue('SystemComponent')) {
      [pscustomobject]@{ key = $_.Name; name = [string]$n; uninstall = [string]$u; location = [string]$_.GetValue('InstallLocation') }
    }
  }
}`)
  const issues = findIssues(arr(run), arr(appPaths), arr(uninstall))
  lastScan = new Map(issues.map((i) => [i.id, i]))
  return issues
}

/** Removes issues from the last scan only, after exporting each key to a .reg backup. */
export async function cleanRegistry(ids: string[], backupDir: string): Promise<RegistryCleanResult> {
  const selected = ids.map((i) => lastScan.get(i)).filter((x): x is RegistryIssue => !!x)
  if (!selected.length) return { ok: false, removed: 0, error: 'Faça uma nova verificação antes de limpar.' }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  let removed = 0
  const errors: string[] = []
  for (const [n, issue] of selected.entries()) {
    const file = join(backupDir, `limpeza-registro__${stamp}__${n}.reg`)
    const exp = await runPs(`reg export '${q(issue.key)}' '${q(file)}' /y | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'backup falhou' }`)
    if (exp.code !== 0) {
      errors.push(`${issue.name}: não foi possível fazer a cópia de segurança`)
      continue
    }
    const del = issue.value
      ? await runPs(`Remove-ItemProperty -Path 'Registry::${q(issue.key)}' -Name '${q(issue.value)}'`)
      : await runPs(`Remove-Item -Path 'Registry::${q(issue.key)}' -Recurse`)
    if (del.code === 0) {
      removed++
      lastScan.delete(issue.id)
    } else errors.push(`${issue.name}: ${del.stderr.split('\n')[0]}`)
  }
  return { ok: errors.length === 0, removed, backupFile: backupDir, error: errors.join('\n') || undefined }
}
