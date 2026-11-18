import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMeta } from '../src/main/services/tweaks'

const DIR = join(__dirname, '..', 'resources', 'tweaks')

describe('parseMeta', () => {
  it('rejects meta without title or description', () => {
    expect(parseMeta('x', { title: 'a' }, false)).toBeNull()
    expect(parseMeta('x', null, false)).toBeNull()
  })

  it('fills safe defaults', () => {
    const m = parseMeta('x', { title: 'A', description: 'B' }, true)!
    expect(m).toMatchObject({ risk: 'safe', reversible: true, recommended: false, hardware: 'any', category: [], backupKeys: [], detectable: true })
  })
})

describe('bundled tweaks', () => {
  const ids = readdirSync(DIR)
  it.each(ids)('%s has valid meta and scripts', (id) => {
    const meta = parseMeta(id, JSON.parse(readFileSync(join(DIR, id, 'meta.json'), 'utf8')), true)
    expect(meta).not.toBeNull()
    expect(meta!.category.length).toBeGreaterThan(0)
    expect(existsSync(join(DIR, id, 'apply.ps1'))).toBe(true)
    if (meta!.reversible) expect(existsSync(join(DIR, id, 'unapply.ps1'))).toBe(true)
  })
})
