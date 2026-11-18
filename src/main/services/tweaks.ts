import { app } from 'electron'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TweakMeta } from '@shared/types'

export function tweaksDir(): string {
  return app.isPackaged ? join(process.resourcesPath, 'tweaks') : join(app.getAppPath(), 'resources', 'tweaks')
}

/** Validates and normalises a raw meta.json object. Returns null if required fields are missing. */
export function parseMeta(id: string, raw: unknown, detectable: boolean): TweakMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  if (typeof m.title !== 'string' || typeof m.description !== 'string') return null
  return {
    id,
    title: m.title,
    description: m.description,
    details: typeof m.details === 'string' ? m.details : undefined,
    confirm: typeof m.confirm === 'string' ? m.confirm : undefined,
    risk: m.risk === 'caution' ? 'caution' : 'safe',
    reversible: m.reversible !== false,
    recommended: m.recommended === true,
    restart: m.restart === true,
    category: Array.isArray(m.category) ? m.category.filter((c): c is string => typeof c === 'string') : [],
    backupKeys: Array.isArray(m.backupKeys) ? m.backupKeys.filter((k): k is string => typeof k === 'string') : [],
    hardware: m.hardware === 'cpu' || m.hardware === 'gpu' ? m.hardware : 'any',
    detectable
  }
}

let cache: TweakMeta[] | null = null

export function loadTweaks(): TweakMeta[] {
  if (cache) return cache
  const dir = tweaksDir()
  const out: TweakMeta[] = []
  for (const id of readdirSync(dir)) {
    const metaPath = join(dir, id, 'meta.json')
    if (!existsSync(metaPath)) continue
    try {
      const meta = parseMeta(id, JSON.parse(readFileSync(metaPath, 'utf8')), existsSync(join(dir, id, 'detect.ps1')))
      if (meta) out.push(meta)
    } catch {
      // ignore malformed tweak folder
    }
  }
  cache = out.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  return cache
}

export function scriptPath(id: string, kind: 'apply' | 'unapply' | 'detect'): string | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null
  const p = join(tweaksDir(), id, `${kind}.ps1`)
  return existsSync(p) ? p : null
}
