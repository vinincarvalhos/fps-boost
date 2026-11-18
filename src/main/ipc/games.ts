import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import type { GameModePrefs, GameSettings } from '@shared/types'
import { activate, deactivate, gameModePrefs, gameModeState, PAUSABLE_SERVICES, setPrefs } from '../services/gamemode'
import { addManualGame, exeCandidates, games, launchGame, removeManualGame, scanGames, setGameSetting, updateGame } from '../services/games/library'

const KEYS: (keyof GameSettings)[] = ['highPriority', 'gpuHigh', 'noFso']

export function registerGamesIpc(): void {
  ipcMain.handle('games:list', () => games())
  ipcMain.handle('games:scan', () => scanGames())

  ipcMain.handle('games:add', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const pick = await dialog.showOpenDialog(win, {
      title: 'Escolha o executável do jogo',
      properties: ['openFile'],
      filters: [{ name: 'Programas', extensions: ['exe'] }]
    })
    if (pick.canceled || !pick.filePaths[0]) return { ok: false }
    const game = await addManualGame(pick.filePaths[0])
    return game ? { ok: true, game } : { ok: false, error: 'Arquivo inválido.' }
  })

  /** Changing the exe moves active per-game settings from the old exe to the new one. */
  ipcMain.handle('games:update', async (_e, id: string, patch: { name?: string; exe?: string; hidden?: boolean }) => {
    const g = games().find((x) => x.id === id)
    if (!g) return { ok: false, error: 'Jogo não encontrado.' }
    const clean: { name?: string; exe?: string; hidden?: boolean } = {}
    if (typeof patch?.name === 'string' && patch.name.trim()) clean.name = patch.name.trim().slice(0, 120)
    if (typeof patch?.hidden === 'boolean') clean.hidden = patch.hidden
    if (typeof patch?.exe === 'string' && patch.exe !== g.exe) {
      if (!existsSync(patch.exe)) return { ok: false, error: 'Executável não encontrado.' }
      const active = KEYS.filter((k) => g.settings[k])
      for (const k of active) await setGameSetting(id, k, false)
      updateGame(id, { exe: patch.exe })
      for (const k of active) await setGameSetting(id, k, true)
    }
    const updated = updateGame(id, clean)
    return updated ? { ok: true, game: updated } : { ok: false, error: 'Não foi possível salvar.' }
  })

  ipcMain.handle('games:remove', (_e, id: string) => ({ ok: removeManualGame(String(id)) }))
  ipcMain.handle('games:launch', (_e, id: string) => launchGame(String(id)))
  ipcMain.handle('games:exe-candidates', async (_e, id: string) => {
    const g = games().find((x) => x.id === id)
    return g && existsSync(g.installDir) ? exeCandidates(g.installDir, g.name) : []
  })
  ipcMain.handle('games:setting', (_e, id: string, key: keyof GameSettings, on: boolean) =>
    KEYS.includes(key) ? setGameSetting(String(id), key, !!on) : { ok: false, error: 'Ajuste desconhecido.' }
  )
  ipcMain.handle('games:open-folder', (_e, id: string) => {
    const g = games().find((x) => x.id === id)
    if (g && existsSync(g.installDir)) shell.openPath(g.installDir)
  })

  ipcMain.handle('gamemode:state', () => gameModeState())
  ipcMain.handle('gamemode:prefs', () => gameModePrefs())
  ipcMain.handle('gamemode:services', () => PAUSABLE_SERVICES)
  ipcMain.handle('gamemode:set-prefs', (_e, patch: Partial<GameModePrefs>) => setPrefs(patch ?? {}))
  ipcMain.handle('gamemode:activate', () => activate(null, true))
  ipcMain.handle('gamemode:deactivate', () => deactivate())
}
