import type { DiskVolume, DnsProvider, OpResult } from '@shared/types'
import { runPs, runPsJson } from './powershell'

export const DNS_PROVIDERS: Omit<DnsProvider, 'ms' | 'current'>[] = [
  { id: 'cloudflare', name: 'Cloudflare', servers: ['1.1.1.1', '1.0.0.1'] },
  { id: 'google', name: 'Google', servers: ['8.8.8.8', '8.8.4.4'] },
  { id: 'quad9', name: 'Quad9', servers: ['9.9.9.9', '149.112.112.112'] },
  { id: 'opendns', name: 'OpenDNS', servers: ['208.67.222.222', '208.67.220.220'] },
  { id: 'adguard', name: 'AdGuard (bloqueia anúncios)', servers: ['94.140.14.14', '94.140.15.15'] }
]

const DOMAINS = ['steamcommunity.com', 'discord.com', 'riotgames.com', 'epicgames.com', 'youtube.com']
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/

export const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** The DNS servers the active adapters use now (empty = automatic/DHCP router). */
async function currentDns(): Promise<string[]> {
  const r = await runPsJson<string | string[]>(
    `Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ? Status -eq 'Up' | % { (Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4).ServerAddresses }`
  )
  return r == null ? [] : Array.isArray(r) ? r : [r]
}

/** Measures each provider's median lookup time (uncached names, direct queries). */
export async function benchmarkDns(): Promise<DnsProvider[]> {
  const current = await currentDns()
  const servers = [...DNS_PROVIDERS.map((p) => p.servers[0]), ...current.filter((s) => IPV4.test(s))]
  const r = await runPsJson<{ server: string; times: number[] } | { server: string; times: number[] }[]>(
    `foreach ($srv in @(${[...new Set(servers)].map((s) => `'${s}'`).join(',')})) {
  $t = @()
  foreach ($d in @(${DOMAINS.map((d) => `'${d}'`).join(',')})) {
    # a random sub-name defeats caches between runs; NXDOMAIN still measures the round trip
    $name = "fpsb$((Get-Random -Maximum 99999)).$d"
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try { Resolve-DnsName -Name $name -Server $srv -DnsOnly -NoHostsFile -QuickTimeout -ErrorAction Stop | Out-Null } catch { if ($_.Exception.Message -match 'timeout|tempo') { $sw.Stop(); continue } }
    $sw.Stop(); $t += [math]::Round($sw.Elapsed.TotalMilliseconds, 1)
  }
  [pscustomobject]@{ server = $srv; times = $t }
}`,
    120_000
  )
  const results = new Map((r == null ? [] : Array.isArray(r) ? r : [r]).map((x) => [x.server, median(Array.isArray(x.times) ? x.times : [x.times])]))
  const list: DnsProvider[] = DNS_PROVIDERS.map((p) => ({ ...p, ms: results.get(p.servers[0]) ?? null, current: current.includes(p.servers[0]) }))
  const isKnown = current.some((s) => DNS_PROVIDERS.some((p) => p.servers.includes(s)))
  if (!isKnown)
    list.unshift({
      id: 'current',
      name: current.length ? 'Atual (provedor/roteador)' : 'Atual (automático)',
      servers: current,
      ms: current[0] ? (results.get(current[0]) ?? null) : null,
      current: true
    })
  return list
}

/** Sets IPv4 DNS on every connected physical adapter; `auto` goes back to DHCP. */
export async function applyDns(providerId: string): Promise<OpResult> {
  const p = DNS_PROVIDERS.find((x) => x.id === providerId)
  if (!p && providerId !== 'auto') return { ok: false, error: 'Provedor desconhecido.' }
  const set = p ? `-ServerAddresses @(${p.servers.map((s) => `'${s}'`).join(',')})` : '-ResetServerAddresses'
  const r = await runPs(
    `$a = @(Get-NetAdapter -Physical | ? Status -eq 'Up'); if (-not $a.Count) { throw 'Nenhuma conexão ativa.' }
foreach ($n in $a) { Set-DnsClientServerAddress -InterfaceIndex $n.ifIndex ${set} }
Clear-DnsClientCache`
  )
  return r.code === 0 ? { ok: true } : { ok: false, error: r.stderr.split('\n')[0] || 'Não foi possível trocar o DNS.' }
}

// ---------- disks ----------

export async function listVolumes(): Promise<DiskVolume[]> {
  const r = await runPsJson<{ l: string; label: string; media: string; size: number; free: number } | { l: string; label: string; media: string; size: number; free: number }[]>(
    `Get-Volume | ? { $_.DriveLetter -and $_.DriveType -eq 'Fixed' } | % {
  $media = try { (Get-Partition -DriveLetter $_.DriveLetter | Get-Disk | Get-PhysicalDisk).MediaType } catch { 'Unspecified' }
  [pscustomobject]@{ l = [string]$_.DriveLetter; label = $_.FileSystemLabel; media = [string]$media; size = $_.Size; free = $_.SizeRemaining }
}`,
    60_000
  )
  return (r == null ? [] : Array.isArray(r) ? r : [r]).map((v) => ({
    letter: v.l,
    label: v.label || 'Disco local',
    media: v.media === 'SSD' ? 'SSD' : v.media === 'HDD' ? 'HDD' : 'Unspecified',
    sizeGb: Math.round(v.size / 1e9),
    freeGb: Math.round(v.free / 1e9)
  }))
}

/** SSD: TRIM. HDD: defragment. Unknown media: Windows decides (Optimize-Volume default). */
export async function optimizeVolume(letter: string): Promise<OpResult> {
  if (!/^[A-Z]$/i.test(letter)) return { ok: false, error: 'Unidade inválida.' }
  const v = (await listVolumes()).find((x) => x.letter.toUpperCase() === letter.toUpperCase())
  if (!v) return { ok: false, error: 'Unidade não encontrada.' }
  const mode = v.media === 'SSD' ? '-ReTrim' : v.media === 'HDD' ? '-Defrag' : ''
  const r = await runPs(`Optimize-Volume -DriveLetter ${letter.toUpperCase()} ${mode}`, 4 * 3600_000)
  return r.code === 0 ? { ok: true } : { ok: false, error: r.stderr.split('\n')[0] || 'A otimização falhou.' }
}

// ---------- network ----------

export async function flushDns(): Promise<OpResult> {
  const r = await runPs('Clear-DnsClientCache')
  return r.code === 0 ? { ok: true } : { ok: false, error: 'Não foi possível limpar o cache de DNS.' }
}

/** Resets Winsock and the TCP/IP stack. Takes effect after a restart. */
export async function resetNetwork(): Promise<OpResult> {
  const r = await runPs('netsh winsock reset | Out-Null; netsh int ip reset | Out-Null; ipconfig /flushdns | Out-Null')
  return r.code === 0 ? { ok: true } : { ok: false, error: 'Não foi possível redefinir a rede.' }
}
