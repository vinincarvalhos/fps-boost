import { describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => process.cwd(), getPath: () => tmpdir() }, BrowserWindow: { getAllWindows: () => [] }, shell: {} }))
vi.mock('electron-log/main', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
vi.mock('../src/main/services/store', () => ({ store: { get: () => [], set: () => {} }, logActivity: () => {} }))

import { parseVdf } from '../src/main/services/games/vdf'
import { epicGamesFrom, steamGamesFrom } from '../src/main/services/games/detect'
import { mergeLibrary, _internal } from '../src/main/services/games/library'
import { findRunningGame } from '../src/main/services/gamemode'

const LIBRARY = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
		"apps" { "730" "123" }
	}
	"1"
	{
		"path"		"D:\\\\SteamLibrary"
	}
}`

const manifest = (id: number, name: string, dir: string, size = '1073741824') => `"AppState"
{
	"appid"		"${id}"
	"name"		"${name}"
	"installdir"		"${dir}"
	"SizeOnDisk"		"${size}"
}`

describe('vdf', () => {
  it('parses nested keys, escapes and comments', () => {
    const v = parseVdf('// comment\n"a" { "b" "x\\\\y" "c" { "d" "1" } }')
    expect(v).toEqual({ a: { b: 'x\\y', c: { d: '1' } } })
  })
})

describe('steam detection', () => {
  it('reads every library and skips Steam tools', () => {
    const games = steamGamesFrom(LIBRARY, (lib) =>
      lib.startsWith('C:')
        ? [manifest(730, 'Counter-Strike 2', 'Counter-Strike Global Offensive'), manifest(228980, 'Steamworks Common Redistributables', 'Steamworks Shared')]
        : [manifest(1091500, 'Cyberpunk 2077', 'Cyberpunk 2077', String(70 * 1024 ** 3)), manifest(1493710, 'Proton Experimental', 'Proton - Experimental')]
    )
    expect(games.map((g) => g.name)).toEqual(['Counter-Strike 2', 'Cyberpunk 2077'])
    expect(games[0].installDir).toBe('C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive')
    expect(games[0].launchUri).toBe('steam://rungameid/730')
    expect(games[1].sizeGb).toBe(70)
  })
})

describe('epic detection', () => {
  it('keeps games and drops DLC and non-game apps', () => {
    const games = epicGamesFrom([
      { DisplayName: 'Fortnite', InstallLocation: 'C:\\Epic\\Fortnite', LaunchExecutable: 'FortniteGame\\Binaries\\Win64\\FortniteLauncher.exe', AppName: 'Fortnite', CatalogNamespace: 'fn', CatalogItemId: 'x', AppCategories: ['public', 'games', 'applications'], bIsApplication: true },
      { DisplayName: 'Some DLC', InstallLocation: 'C:\\Epic\\Game', AppName: 'dlc1', MainGameAppName: 'Game', AppCategories: ['games'] },
      { DisplayName: 'Unreal Engine', InstallLocation: 'C:\\UE', AppName: 'UE_5', AppCategories: ['engines'] }
    ])
    expect(games.map((g) => g.name)).toEqual(['Fortnite'])
    expect(games[0].exe).toBe('C:\\Epic\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteLauncher.exe')
    expect(games[0].launchUri).toContain('com.epicgames.launcher://apps/')
  })
})

describe('library merge', () => {
  it('keeps user choices and drops games that were uninstalled', () => {
    const saved = [
      { id: 'steam:1', name: 'A', source: 'steam' as const, installDir: 'C:\\A', exe: 'C:\\A\\custom.exe', hidden: true, settings: { highPriority: true, gpuHigh: false, noFso: false } },
      { id: 'steam:2', name: 'Gone', source: 'steam' as const, installDir: 'C:\\Gone', settings: { highPriority: false, gpuHigh: false, noFso: false } }
    ]
    const merged = mergeLibrary(saved, [{ id: 'steam:1', name: 'A', source: 'steam', installDir: 'C:\\A', exe: 'C:\\A\\default.exe' }])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ exe: 'C:\\A\\custom.exe', hidden: true, settings: { highPriority: true } })
  })
})

describe('game mode detection', () => {
  const lib = [
    { id: 'steam:730', name: 'CS2', installDir: 'D:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive', hidden: false },
    { id: 'x', name: 'Hidden', installDir: 'C:\\Games\\Hidden', hidden: true },
    { id: 'short', name: 'Bad', installDir: 'C:\\', hidden: false }
  ]
  it('finds the game by its install folder, case-insensitive', () => {
    expect(findRunningGame(['C:\\Windows\\explorer.exe', 'd:\\steamlibrary\\steamapps\\common\\counter-strike global offensive\\game\\bin\\win64\\cs2.exe'], lib)).toEqual({ id: 'steam:730', name: 'CS2' })
  })
  it('ignores hidden games, too-short folders and sibling folders with the same prefix', () => {
    expect(findRunningGame(['C:\\Games\\Hidden\\h.exe', 'C:\\Windows\\notepad.exe'], lib)).toBeNull()
    expect(findRunningGame(['D:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive 2\\x.exe'], lib)).toBeNull()
  })
})

describe('per-game settings scripts', () => {
  it('targets the right registry places and keeps other compatibility flags', () => {
    const exe = "C:\\Games\\It's\\game.exe"
    expect(_internal.settingScript('highPriority', exe, true)).toContain("Image File Execution Options\\game.exe\\PerfOptions")
    expect(_internal.settingScript('gpuHigh', exe, true)).toContain("-Name 'C:\\Games\\It''s\\game.exe' -Value 'GpuPreference=2;'")
    const fso = _internal.settingScript('noFso', exe, false)
    expect(fso).toContain("-ne 'DISABLEDXMAXIMIZEDWINDOWEDMODE'")
    expect(fso).not.toContain("$flags += 'DISABLEDXMAXIMIZEDWINDOWEDMODE'")
  })
})

import { rankExes } from '../src/main/services/games/library'

describe('main executable ranking', () => {
  it('prefers the exe named after the game (or its initials) over bigger tools', () => {
    const base = 'C:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\bin\\win64\\'
    expect(
      rankExes('Counter-Strike 2', [
        { path: base + 'vconsole2.exe', size: 90e6 },
        { path: base + 'cs2.exe', size: 1e6 },
        { path: base + 'steamerrorreporter.exe', size: 2e6 }
      ])[0]
    ).toBe(base + 'cs2.exe')
    expect(
      rankExes('Cyberpunk 2077', [
        { path: 'C:\\G\\REDprelauncher.exe', size: 5e6 },
        { path: 'C:\\G\\bin\\x64\\Cyberpunk2077.exe', size: 60e6 }
      ])[0]
    ).toBe('C:\\G\\bin\\x64\\Cyberpunk2077.exe')
  })
  it('falls back to size when no name matches', () => {
    expect(
      rankExes('Some Game', [
        { path: 'C:\\G\\a.exe', size: 1e6 },
        { path: 'C:\\G\\b.exe', size: 9e6 }
      ])[0]
    ).toBe('C:\\G\\b.exe')
  })
})
