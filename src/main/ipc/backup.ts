import { ipcMain } from 'electron'
import { readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { runPs } from '../services/powershell'
import { createRestorePoint, deleteAllRestorePoints, listRestorePoints, restoreTo } from '../services/restore'
import { logActivity } from '../services/store'
import { registryBackupDir } from './tweaks'

export interface RegistryBackup {
  file: string
  tweakId: string
  createdAt: string
  sizeKb: number
}

export function registerBackupIpc(): void {
  ipcMain.handle('backup:list', () => listRestorePoints())
  ipcMain.handle('backup:create', async (_e, description: string) => {
    const name = typeof description === 'string' && description.trim() ? description : 'FpsBoost'
    const res = await createRestorePoint(name)
    if (res.ok) logActivity({ kind: 'restore-point', title: name })
    return res
  })
  ipcMain.handle('backup:restore', (_e, sequence: number) => restoreTo(sequence))
  ipcMain.handle('backup:delete-all', () => deleteAllRestorePoints())

  ipcMain.handle('backup:registry-list', (): RegistryBackup[] => {
    const dir = registryBackupDir()
    return readdirSync(dir)
      .filter((f) => f.endsWith('.reg'))
      .map((f) => {
        const st = statSync(join(dir, f))
        return { file: f, tweakId: f.split('__')[0], createdAt: st.mtime.toISOString(), sizeKb: Math.ceil(st.size / 1024) }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  ipcMain.handle('backup:registry-restore', async (_e, file: string) => {
    const name = basename(String(file))
    if (!name.endsWith('.reg')) return { ok: false, error: 'Arquivo inválido' }
    const full = join(registryBackupDir(), name).replace(/'/g, "''")
    const res = await runPs(`reg import '${full}' 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'reg import falhou' }`)
    return res.code === 0 ? { ok: true } : { ok: false, error: res.stderr }
  })
}
