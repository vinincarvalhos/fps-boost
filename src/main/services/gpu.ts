import { app } from 'electron'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'
import type { GpuMetrics, GpuState, NvSettingOption, OpResult } from '@shared/types'
import { runPs } from './powershell'
import { store } from './store'

// ---------- NVIDIA driver settings (IDs and values from NVIDIA's NvApiDriverSettings.h) ----------

export const NV_OPTIONS: NvSettingOption[] = [
  { key: 'power', title: 'Modo de energia: máximo desempenho', description: 'A GPU não reduz o clock entre quadros, evitando quedas de FPS.', id: 0x1057eb71, value: 0x1, recommended: true },
  { key: 'latency', title: 'Baixa latência: 1 quadro na fila', description: 'A CPU prepara no máximo 1 quadro adiantado, reduzindo o atraso do mouse.', id: 0x007ba09e, value: 1, recommended: true },
  { key: 'texture', title: 'Filtragem de textura: alto desempenho', description: 'Troca uma qualidade de textura quase imperceptível por mais FPS.', id: 0x00ce2691, value: 0x14, recommended: true },
  { key: 'aniso', title: 'Otimização de amostra anisotrópica', description: 'Reduz o custo da filtragem anisotrópica.', id: 0x00e73211, value: 1, recommended: true },
  { key: 'trilinear', title: 'Otimização trilinear', description: 'Filtragem trilinear mais leve.', id: 0x002ecaf2, value: 1, recommended: true },
  { key: 'threaded', title: 'Otimização com threads (OpenGL)', description: 'Usa mais núcleos da CPU em jogos OpenGL.', id: 0x20c1221e, value: 1, recommended: true },
  { key: 'triple', title: 'Buffer triplo desligado (OpenGL)', description: 'Menos atraso de imagem em jogos OpenGL.', id: 0x20fdd1f9, value: 0, recommended: true },
  { key: 'fxaa', title: 'FXAA forçado desligado', description: 'Deixa o antisserrilhamento por conta de cada jogo.', id: 0x1074c972, value: 0, recommended: true },
  { key: 'shadercache', title: 'Cache de shader ligado', description: 'Guarda shaders compilados para os jogos não engasgarem ao reabrir.', id: 0x00198fff, value: 1, recommended: true },
  {
    key: 'vsync',
    title: 'V-Sync forçado desligado',
    description: 'Menos latência, mas pode aparecer tearing. Quem usa G-SYNC normalmente prefere manter o V-Sync ligado no painel.',
    id: 0x00a879cf,
    value: 0x08416747,
    recommended: false
  }
]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** A .nip for the global driver profile (empty ProfileName), in NVIDIA Profile Inspector's format. */
export function buildNip(options: NvSettingOption[]): string {
  const settings = options
    .map(
      (o) => `      <ProfileSetting>
        <SettingNameInfo>${esc(o.title)}</SettingNameInfo>
        <SettingID>${o.id >>> 0}</SettingID>
        <SettingValue>${o.value >>> 0}</SettingValue>
        <ValueType>Dword</ValueType>
      </ProfileSetting>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="utf-16"?>
<Profiles>
  <Profile>
    <ProfileName />
    <Executeables />
    <Settings>
${settings}
    </Settings>
  </Profile>
</Profiles>
`
}

/** NPI writes .nip files as UTF-16 LE with a BOM. */
export const encodeNip = (xml: string) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')])

/**
 * From an `-exportCustomized` backup, keep only the global profile (empty name), so restoring
 * touches nothing else. Returns a .nip with an empty global profile when it wasn't customized.
 */
export function globalProfileFromBackup(xml: string): string {
  const profiles = xml.match(/<Profile>[\s\S]*?<\/Profile>/g) ?? []
  const global = profiles.find((p) => /<ProfileName\s*\/>|<ProfileName>\s*<\/ProfileName>/.test(p))
  const body = global ?? '<Profile>\n    <ProfileName />\n    <Executeables />\n    <Settings />\n  </Profile>'
  return `<?xml version="1.0" encoding="utf-16"?>\n<Profiles>\n  ${body}\n</Profiles>\n`
}

// ---------- NVIDIA Profile Inspector (downloaded on demand, pinned and hash-checked) ----------

export const NPI = {
  version: 'v3.0.2.1',
  url: 'https://github.com/Orbmu2k/nvidiaProfileInspector/releases/download/v3.0.2.1/nvidiaProfileInspector.zip',
  sha256: '88dcf3514111e8de630688467c03c36d8c2a8ad9ebc8073f27c069f82b75bb40',
  sizeKb: 424
}

const toolsDir = () => join(app.getPath('userData'), 'tools', `npi-${NPI.version}`)
const nvDir = () => {
  const d = join(app.getPath('userData'), 'nvidia')
  mkdirSync(d, { recursive: true })
  return d
}

function findExe(dir: string): string | null {
  if (!existsSync(dir)) return null
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isFile() && e.name.toLowerCase() === 'nvidiaprofileinspector.exe') return p
    if (e.isDirectory()) {
      const sub = findExe(p)
      if (sub) return sub
    }
  }
  return null
}

export const npiExe = () => findExe(toolsDir())

export async function downloadNpi(): Promise<OpResult> {
  try {
    const res = await fetch(NPI.url, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) return { ok: false, error: `Download falhou (HTTP ${res.status}).` }
    const buf = Buffer.from(await res.arrayBuffer())
    const hash = createHash('sha256').update(buf).digest('hex')
    if (hash !== NPI.sha256) {
      log.warn('[gpu] NPI hash diferente', hash)
      return { ok: false, error: 'O arquivo baixado não confere com a versão oficial esperada e foi descartado.' }
    }
    const dir = toolsDir()
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const zip = join(dir, 'npi.zip')
    writeFileSync(zip, buf)
    const r = await runPs(`Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`, 60_000)
    rmSync(zip, { force: true })
    if (r.code !== 0 || !npiExe()) return { ok: false, error: 'Não foi possível extrair o NVIDIA Profile Inspector.' }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: `Sem conexão com o GitHub (${(err as Error).message}).` }
  }
}

/** Runs NPI with arguments and waits; NPI exits by itself in silent/export modes. */
async function runNpi(args: string[]): Promise<boolean> {
  const exe = npiExe()
  if (!exe) return false
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  // file paths are passed quoted so spaces survive Start-Process's argument joining
  const list = args.map((a) => (a.startsWith('-') ? q(a) : q(`"${a}"`))).join(',')
  const r = await runPs(`$p = Start-Process -FilePath ${q(exe)} -ArgumentList @(${list}) -Wait -PassThru -WindowStyle Hidden; exit $p.ExitCode`, 120_000)
  return r.code === 0
}

/** Backs up the current customized profiles (once), then merges FpsBoost's settings into the global profile. */
export async function applyNvidia(keys: string[]): Promise<OpResult> {
  const exe = npiExe()
  if (!exe) return { ok: false, error: 'Baixe o NVIDIA Profile Inspector primeiro.' }
  const chosen = NV_OPTIONS.filter((o) => keys.includes(o.key))
  if (!chosen.length) return { ok: false, error: 'Escolha pelo menos uma configuração.' }

  if (!store.get('gpuBackup')) {
    // -exportCustomized writes a timestamped .nip next to the exe and exits
    const before = new Set(readdirSync(join(exe, '..')))
    await runNpi(['-exportCustomized'])
    const created = readdirSync(join(exe, '..')).find((f) => f.toLowerCase().endsWith('.nip') && !before.has(f))
    const backup = join(nvDir(), 'antes-do-fpsboost.nip')
    if (created) {
      const raw = readFileSync(join(exe, '..', created))
      const xml = raw[0] === 0xff && raw[1] === 0xfe ? raw.subarray(2).toString('utf16le') : raw.toString('utf8')
      writeFileSync(backup, encodeNip(globalProfileFromBackup(xml)))
      rmSync(join(exe, '..', created), { force: true })
    } else writeFileSync(backup, encodeNip(globalProfileFromBackup(''))) // nothing customized yet: restore = defaults
    store.set('gpuBackup', { file: backup, at: new Date().toISOString() })
  }

  const file = join(nvDir(), 'fpsboost.nip')
  writeFileSync(file, encodeNip(buildNip(chosen)))
  const ok = await runNpi(['-silentImport', '-mergeImport', file])
  if (!ok) return { ok: false, error: 'O NVIDIA Profile Inspector não conseguiu aplicar as configurações.' }
  store.set('gpuApplied', { keys: chosen.map((c) => c.key), at: new Date().toISOString() })
  return { ok: true, done: chosen.length }
}

/** Puts the global profile back exactly as it was before FpsBoost's first change. */
export async function restoreNvidia(): Promise<OpResult> {
  const b = store.get('gpuBackup')
  if (!b || !existsSync(b.file)) return { ok: false, error: 'Não há cópia de segurança do perfil da NVIDIA.' }
  const ok = await runNpi(['-silentImport', '-replaceImport', b.file])
  if (!ok) return { ok: false, error: 'Não foi possível restaurar o perfil da NVIDIA.' }
  store.set('gpuApplied', null)
  store.set('gpuBackup', null)
  return { ok: true }
}

// ---------- metrics and state ----------

const SMI = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\nvidia-smi.exe`

/** Parses one `nvidia-smi --format=csv,noheader,nounits` line. Pure, for tests. */
export function parseSmi(line: string): GpuMetrics | null {
  const c = line.split(',').map((s) => s.trim())
  if (c.length < 11) return null
  const n = (s: string) => (s === '' || /N\/A|Not Supported|\[/.test(s) ? null : Math.round(Number(s)))
  return {
    name: c[0],
    driver: c[1],
    tempC: n(c[2]),
    loadPct: n(c[3]),
    coreMhz: n(c[4]),
    memMhz: n(c[5]),
    powerW: n(c[6]),
    powerLimitW: n(c[7]),
    vramUsedMb: n(c[8]),
    vramTotalMb: n(c[9]),
    fanPct: n(c[10])
  }
}

/** Runs nvidia-smi directly (no PowerShell: it is polled every few seconds, even while gaming). */
export function gpuMetrics(): Promise<GpuMetrics | null> {
  if (!existsSync(SMI)) return Promise.resolve(null)
  const args = [
    '--query-gpu=name,driver_version,temperature.gpu,utilization.gpu,clocks.gr,clocks.mem,power.draw,power.limit,memory.used,memory.total,fan.speed',
    '--format=csv,noheader,nounits'
  ]
  return new Promise((resolve) => {
    execFile(SMI, args, { windowsHide: true, timeout: 10_000 }, (err, stdout) => resolve(err ? null : parseSmi(stdout.split(/\r?\n/)[0] ?? '')))
  })
}

export async function gpuState(model: string, vendorRaw: string, driver?: string): Promise<GpuState> {
  const v = `${vendorRaw} ${model}`.toLowerCase()
  const vendor = /nvidia|geforce|rtx|gtx/.test(v) ? 'nvidia' : /amd|radeon|advanced micro/.test(v) ? 'amd' : /intel/.test(v) ? 'intel' : 'other'
  const backup = store.get('gpuBackup')
  const applied = store.get('gpuApplied')
  return {
    vendor,
    model,
    driver,
    metricsAvailable: vendor === 'nvidia' && existsSync(SMI),
    npiReady: !!npiExe(),
    backupAt: backup?.at,
    appliedAt: applied?.at,
    appliedKeys: applied?.keys ?? []
  }
}

/** Opens AMD Software (Adrenalin) when installed. */
export function amdSoftwarePath(): string | null {
  const p = 'C:\\Program Files\\AMD\\CNext\\CNext\\RadeonSoftware.exe'
  try {
    return existsSync(p) && statSync(p).isFile() ? p : null
  } catch {
    return null
  }
}
