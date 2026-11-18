import type { DriverInfo, DriverUpdate, OpResult } from '@shared/types'
import { runPs, runPsJson } from './powershell'

const CLASSES: Record<string, string> = {
  DISPLAY: 'Placa de vídeo',
  NET: 'Rede',
  MEDIA: 'Áudio',
  HDC: 'Armazenamento',
  SCSIADAPTER: 'Armazenamento',
  BLUETOOTH: 'Bluetooth',
  USB: 'USB',
  SYSTEM: 'Chipset e sistema'
}

interface RawDriver {
  name: string
  cls: string
  provider: string
  version: string
  date: string
}

/** WMI CIM_DATETIME "20240115000000.******+***" → ISO date; ages from `now`. Pure, for tests. */
export function toDriverInfo(raw: RawDriver[], now = Date.now()): DriverInfo[] {
  const seen = new Set<string>()
  const out: DriverInfo[] = []
  for (const d of raw) {
    const kind = CLASSES[d.cls?.toUpperCase()]
    if (!kind || !d.name) continue
    // chipset class has dozens of generic Microsoft entries; keep vendor drivers only
    if (kind === 'Chipset e sistema' && /microsoft/i.test(d.provider)) continue
    const key = `${d.name}|${d.version}`
    if (seen.has(key)) continue
    seen.add(key)
    // internal virtual adapters say nothing useful to a player
    if (/kernel debug|wan miniport|wi-fi direct virtual/i.test(d.name)) continue
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(d.date ?? '')
    // Windows' own inbox drivers carry a placeholder date of June 2006; it isn't their real age
    const inbox = /microsoft/i.test(d.provider) && m?.[1] === '2006'
    const date = m && !inbox ? `${m[1]}-${m[2]}-${m[3]}` : undefined
    out.push({
      name: d.name,
      kind,
      provider: inbox ? 'Microsoft (incluído no Windows)' : d.provider || '—',
      version: d.version || '—',
      date,
      ageDays: date ? Math.max(0, Math.floor((now - Date.parse(date)) / 86400000)) : undefined
    })
  }
  const order = Object.values(CLASSES)
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name))
}

export async function listDrivers(): Promise<DriverInfo[]> {
  const raw = await runPsJson<RawDriver | RawDriver[]>(
    `Get-CimInstance Win32_PnPSignedDriver | ? { $_.DeviceClass -in ${Object.keys(CLASSES).map((c) => `'${c}'`).join(',')} } | % {
  [pscustomobject]@{ name = [string]$_.DeviceName; cls = [string]$_.DeviceClass; provider = [string]$_.DriverProviderName; version = [string]$_.DriverVersion; date = if ($_.DriverDate) { $_.DriverDate.ToString('yyyyMMdd') } else { '' } }
}`,
    90_000
  )
  return toDriverInfo(raw == null ? [] : Array.isArray(raw) ? raw : [raw])
}

// ---------- Windows Update ----------

const SEARCH = `$s = New-Object -ComObject Microsoft.Update.Session; $s.ClientApplicationID = 'FpsBoost'
$r = $s.CreateUpdateSearcher().Search("IsInstalled=0 and Type='Driver' and IsHidden=0")`

export async function searchDriverUpdates(): Promise<{ ok: boolean; updates: DriverUpdate[]; error?: string }> {
  const r = await runPsJson<
    { id: string; title: string; provider: string; cls: string; date: string; size: number } | { id: string; title: string; provider: string; cls: string; date: string; size: number }[]
  >(
    `${SEARCH}
@($r.Updates) | % { [pscustomobject]@{ id = $_.Identity.UpdateID; title = $_.Title; provider = [string]$_.DriverProvider; cls = [string]$_.DriverClass; date = if ($_.DriverVerDate) { $_.DriverVerDate.ToString('yyyy-MM-dd') } else { '' }; size = [int64]$_.MaxDownloadSize } }`,
    5 * 60_000
  )
  if (r === null) {
    // runPsJson returns null both for "no output" (no updates) and for errors; tell them apart
    const probe = await runPs(`${SEARCH}; $r.Updates.Count`, 5 * 60_000)
    if (probe.code !== 0) return { ok: false, updates: [], error: 'O Windows Update não respondeu. Verifique a conexão e tente de novo.' }
    return { ok: true, updates: [] }
  }
  const list = Array.isArray(r) ? r : [r]
  return {
    ok: true,
    updates: list.map((u) => ({ id: u.id, title: u.title, provider: u.provider, driverClass: u.cls, date: u.date || undefined, sizeMb: Math.round(u.size / 1048576) }))
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Downloads and installs the chosen driver updates through the Windows Update agent. */
export async function installDriverUpdates(ids: string[]): Promise<OpResult & { reboot?: boolean }> {
  const wanted = ids.filter((i) => GUID.test(i))
  if (!wanted.length) return { ok: false, error: 'Nenhuma atualização selecionada.' }
  const r = await runPsJson<{ code: number; reboot: boolean; installed: number }>(
    `${SEARCH}
$want = @(${wanted.map((i) => `'${i}'`).join(',')})
$col = New-Object -ComObject Microsoft.Update.UpdateColl
foreach ($u in $r.Updates) { if ($want -contains $u.Identity.UpdateID) { if (-not $u.EulaAccepted) { $u.AcceptEula() }; [void]$col.Add($u) } }
if ($col.Count -eq 0) { throw 'As atualizações não estão mais disponíveis.' }
$d = $s.CreateUpdateDownloader(); $d.Updates = $col; [void]$d.Download()
$i = $s.CreateUpdateInstaller(); $i.Updates = $col; $res = $i.Install()
$ok = 0; for ($n = 0; $n -lt $col.Count; $n++) { if ($res.GetUpdateResult($n).ResultCode -eq 2) { $ok++ } }
[pscustomobject]@{ code = [int]$res.ResultCode; reboot = [bool]$res.RebootRequired; installed = $ok }`,
    30 * 60_000
  )
  if (!r) return { ok: false, error: 'A instalação pelo Windows Update falhou. Rode o FpsBoost como administrador e tente de novo.' }
  // OperationResultCode: 2 = succeeded, 3 = succeeded with errors
  return { ok: r.code === 2, done: r.installed, reboot: r.reboot, error: r.code === 2 ? undefined : `${r.installed} de ${wanted.length} instalados.` }
}

export const VENDOR_PAGES = {
  nvidia: 'https://www.nvidia.com/pt-br/software/nvidia-app/',
  amd: 'https://www.amd.com/pt/support/download/drivers.html',
  intel: 'https://www.intel.com.br/content/www/br/pt/support/detect.html'
} as const
