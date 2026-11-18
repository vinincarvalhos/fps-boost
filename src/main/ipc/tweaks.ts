import { app, ipcMain } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'
import type { TweakResult } from '@shared/types'
import { runPs, runPsFile } from '../services/powershell'
import { logActivity, store } from '../services/store'
import { createRestorePoint } from '../services/restore'
import { loadTweaks, scriptPath } from '../services/tweaks'

export function registryBackupDir(): string {
  const dir = join(app.getPath('userData'), 'backups', 'registry')
  mkdirSync(dir, { recursive: true })
  return dir
}

async function backupRegistry(id: string, keys: string[]): Promise<void> {
  const dir = registryBackupDir()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  for (const [i, key] of keys.entries()) {
    const file = join(dir, `${id}__${stamp}__${i}.reg`).replace(/'/g, "''")
    // reg.exe wants HKLM\... not HKLM:\...
    const regKey = key.replace(/^(HK[A-Z_]+):\\/, '$1\\').replace(/'/g, "''")
    await runPs(`if (Test-Path 'Registry::${regKey}') { reg export '${regKey}' '${file}' /y | Out-Null }`)
  }
}

/** Serialises tweak runs: two scripts touching the same keys at once can clobber each other's saved state. */
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.catch(() => undefined)
  return next
}

async function detect(id: string): Promise<boolean | null> {
  const p = scriptPath(id, 'detect')
  if (!p) return null
  const res = await runPsFile(p, 30_000)
  if (res.code !== 0) return null
  return res.stdout.trim().split(/\r?\n/).pop() === '1'
}

export function registerTweakIpc(): void {
  ipcMain.handle('tweaks:list', () => loadTweaks())

  ipcMain.handle('tweaks:states', async () => {
    const saved = store.get('tweaks')
    const states: Record<string, boolean> = {}
    // Each detect spawns a PowerShell; a few at a time keeps the rest of the app responsive.
    const pending = [...loadTweaks()]
    const worker = async () => {
      for (let t = pending.shift(); t; t = pending.shift()) {
        const real = t.detectable ? await detect(t.id) : null
        states[t.id] = real ?? saved[t.id] === true
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
    return states
  })

  ipcMain.handle('tweaks:apply', (_e, id: string) =>
    enqueue(async (): Promise<TweakResult> => {
      const meta = loadTweaks().find((t) => t.id === id)
      const file = scriptPath(id, 'apply')
      if (!meta || !file) return { ok: false, output: '', error: 'Ajuste não encontrado' }

      if (store.get('settings').autoRestorePoint && !store.get('firstTweakRestorePointDone')) {
        const rp = await createRestorePoint('FpsBoost - antes dos ajustes')
        if (rp.ok) store.set('firstTweakRestorePointDone', true)
        else log.warn('[tweaks] ponto de restauração automático falhou', rp.error)
      }
      if (meta.backupKeys.length) await backupRegistry(id, meta.backupKeys)

      const res = await runPsFile(file)
      if (res.code !== 0) return { ok: false, output: res.stdout, error: res.stderr || `Código ${res.code}` }
      store.set(`tweaks.${id}`, true)
      logActivity({ kind: 'applied', title: meta.title })
      return { ok: true, output: res.stdout }
    })
  )

  ipcMain.handle('tweaks:unapply', (_e, id: string) =>
    enqueue(async (): Promise<TweakResult> => {
      const file = scriptPath(id, 'unapply')
      if (!file) return { ok: false, output: '', error: 'Este ajuste não pode ser revertido automaticamente' }
      const res = await runPsFile(file)
      if (res.code !== 0) return { ok: false, output: res.stdout, error: res.stderr || `Código ${res.code}` }
      store.set(`tweaks.${id}`, false)
      logActivity({ kind: 'reverted', title: loadTweaks().find((t) => t.id === id)?.title ?? id })
      return { ok: true, output: res.stdout }
    })
  )
}
