import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync, symlinkSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => process.cwd(), getPath: () => tmpdir() }, BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('electron-log/main', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
vi.mock('../src/main/services/store', () => ({ store: { get: () => [], set: () => {} }, logActivity: () => {} }))

import { clean, isForbiddenRoot } from '../src/main/services/cleaner'
import { exeFromCommand, findIssues } from '../src/main/services/registryClean'
import { matchesProgram, normalizeName, normalizeUninstall } from '../src/main/services/programs'
import { inPreset, isProtected, mergeCatalog } from '../src/main/services/appx'

describe('cleaner safety', () => {
  it('refuses drive roots, system and personal folders', () => {
    for (const p of ['C:\\', 'C:', 'C:\\Windows', 'C:\\Windows\\System32\\drivers', 'C:\\Program Files', process.env.USERPROFILE ?? 'C:\\Users\\x', 'relative\\path'])
      expect(isForbiddenRoot(p), p).toBe(true)
    expect(isForbiddenRoot(join(tmpdir(), 'fpsboost-ok'))).toBe(false)
  })
})

describe('cleaner on a scratch folder', () => {
  let dir: string
  let outside: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fpsb-clean-'))
    outside = mkdtempSync(join(tmpdir(), 'fpsb-outside-'))
    mkdirSync(join(dir, 'sub', 'deep'), { recursive: true })
    writeFileSync(join(dir, 'a.tmp'), 'x'.repeat(1000))
    writeFileSync(join(dir, 'sub', 'deep', 'b.tmp'), 'y'.repeat(500))
    writeFileSync(join(outside, 'keep.txt'), 'precious')
    try {
      symlinkSync(outside, join(dir, 'link'), 'junction')
    } catch {
      /* junctions need no admin, but tolerate environments without them */
    }
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })

  it('deletes files inside, keeps the root, prunes empty dirs and never follows junctions', async () => {
    const r = await clean(['custom'], [dir])
    expect(r.freedBytes).toBe(1500)
    expect(r.deleted).toBe(2)
    expect(existsSync(dir)).toBe(true)
    expect(existsSync(join(dir, 'sub'))).toBe(false)
    expect(existsSync(join(outside, 'keep.txt'))).toBe(true) // the junction target is untouched
  })

  it('ignores categories that were not selected', async () => {
    const r = await clean(['user-temp-not-selected'], [dir])
    expect(r.deleted).toBe(0)
    expect(readdirSync(dir).length).toBeGreaterThan(0)
  })

  it('a forbidden custom folder is dropped', async () => {
    const r = await clean(['custom'], ['C:\\Windows'])
    expect(r.deleted).toBe(0)
  })

  it('respects the minimum age of files', async () => {
    utimesSync(join(dir, 'a.tmp'), new Date(), new Date())
    // custom folders have no min age; check through the internal walker instead
    const { _internal } = await import('../src/main/services/cleaner')
    const seen: string[] = []
    await _internal.walk(dir, { minAgeHours: 1 }, (p) => {
      seen.push(p)
    })
    expect(seen).toHaveLength(0)
  })
})

describe('registry cleaner', () => {
  const env = { ProgramFiles: 'C:\\Program Files', windir: 'C:\\Windows' }
  it('extracts executables from command lines', () => {
    expect(exeFromCommand('"C:\\App Dir\\a.exe" --tray', env)).toBe('C:\\App Dir\\a.exe')
    expect(exeFromCommand('C:\\App Dir\\a.exe --tray', env)).toBe('C:\\App Dir\\a.exe')
    expect(exeFromCommand('%ProgramFiles%\\X\\x.exe', env)).toBe('C:\\Program Files\\X\\x.exe')
    expect(exeFromCommand('C:\\X\\icon.exe,0', env)).toBe('C:\\X\\icon.exe')
    expect(exeFromCommand('msiexec.exe /x {A}', env)).toBeNull()
    expect(exeFromCommand('', env)).toBeNull()
  })

  it('flags only entries whose files are gone, and skips MSI uninstalls', () => {
    const exists = (p: string) => p.startsWith('C:\\Exists')
    const issues = findIssues(
      [
        { key: 'HKCU\\Run', value: 'Gone', data: '"C:\\Gone\\g.exe" -min' },
        { key: 'HKCU\\Run', value: 'Ok', data: 'C:\\Exists\\o.exe' }
      ],
      [{ key: 'HKLM\\App Paths\\x.exe', name: 'x.exe', data: 'C:\\Gone\\x.exe' }],
      [
        { key: 'HKLM\\Uninstall\\A', name: 'A', uninstall: 'C:\\Gone\\unins.exe', location: '' },
        { key: 'HKLM\\Uninstall\\B', name: 'B', uninstall: 'C:\\Gone\\unins.exe', location: 'C:\\Exists\\B' },
        { key: 'HKLM\\Uninstall\\C', name: 'C', uninstall: 'MsiExec.exe /X{123}', location: '' }
      ],
      exists
    )
    expect(issues.map((i) => i.name)).toEqual(['Gone', 'x.exe', 'A'])
  })

  it('never flags app execution aliases in WindowsApps', () => {
    const issues = findIssues(
      [{ key: 'HKCU\\Run', value: 'Teams', data: 'C:\\Users\\u\\AppData\\Local\\Microsoft\\WindowsApps\\MSTeams_8wekyb3d8bbwe\\ms-teams.exe' }],
      [],
      []
    )
    expect(issues).toHaveLength(0)
  })
})

describe('uninstaller helpers', () => {
  it('normalizes names', () => {
    expect(normalizeName('Foo Bar 2.1.3 (x64)')).toBe('foo bar')
    expect(normalizeName('Some-App_v12')).toBe('some app')
  })
  it('matches leftover folders strictly', () => {
    expect(matchesProgram('Discord', 'Discord')).toBe(true)
    expect(matchesProgram('OBS-Studio', 'OBS Studio 30.1')).toBe(true)
    expect(matchesProgram('SteamVR', 'Steam')).toBe(false)
    expect(matchesProgram('Microsoft', 'Microsoft')).toBe(false)
    expect(matchesProgram('App', 'App')).toBe(false)
  })
  it('turns MSI repair commands into uninstall', () => {
    expect(normalizeUninstall('MsiExec.exe /I{ABC-123}')).toBe('MsiExec.exe /X{ABC-123}')
    expect(normalizeUninstall('"C:\\x\\unins000.exe"')).toBe('"C:\\x\\unins000.exe"')
  })
})

describe('windows apps', () => {
  it('never exposes protected packages', () => {
    for (const n of ['Microsoft.WindowsStore', 'Microsoft.DesktopAppInstaller', 'Microsoft.WindowsTerminal', 'Microsoft.HEVCVideoExtension', 'Microsoft.VCLibs.140.00', 'Microsoft.SecHealthUI', 'Microsoft.MicrosoftEdge.Stable'])
      expect(isProtected(n), n).toBe(true)
    expect(isProtected('Microsoft.BingNews')).toBe(false)
  })

  it('merges installed packages with the catalog and drops system/framework ones', () => {
    const list = mergeCatalog(
      [
        { Name: 'Microsoft.BingNews', Version: '1', IsFramework: false, NonRemovable: false, SignatureKind: 'Store' },
        { Name: 'Microsoft.VCLibs.140.00', Version: '1', IsFramework: true, NonRemovable: false, SignatureKind: 'Store' },
        { Name: 'Some.Other', Version: '2', IsFramework: false, NonRemovable: false, SignatureKind: 'Store' },
        { Name: 'Core.Thing', Version: '1', IsFramework: false, NonRemovable: true, SignatureKind: 'System' }
      ],
      [
        { name: 'Microsoft.BingNews', title: 'Notícias', description: '', preset: 'basic' },
        { name: 'Microsoft.Paint', title: 'Paint', description: '', preset: 'extreme' }
      ]
    )
    expect(list.find((e) => e.name === 'Microsoft.BingNews')?.installed).toBe(true)
    expect(list.find((e) => e.name === 'Microsoft.Paint')?.installed).toBe(false)
    expect(list.some((e) => e.name === 'Some.Other' && e.preset === null)).toBe(true)
    expect(list.some((e) => e.name === 'Core.Thing' || e.name.startsWith('Microsoft.VCLibs'))).toBe(false)
  })

  it('presets are cumulative', () => {
    expect(inPreset({ preset: 'basic' }, 'recommended')).toBe(true)
    expect(inPreset({ preset: 'extreme' }, 'recommended')).toBe(false)
    expect(inPreset({ preset: null }, 'extreme')).toBe(false)
  })
})
