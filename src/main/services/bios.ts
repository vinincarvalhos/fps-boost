import { existsSync } from 'node:fs'
import type { BiosCheck, BiosReport } from '@shared/types'
import { runPs, runPsJson } from './powershell'

/** Everything FpsBoost reads about the firmware from Windows. Nothing is written to the BIOS. */
export interface RawFirmware {
  biosVendor: string
  biosVersion: string
  biosDate: string // yyyyMMdd or ''
  boardVendor: string
  board: string
  /** Win32_ComputerSystem maker/model: what laptops and branded PCs are sold as */
  pcVendor: string
  pcModel: string
  /** Win32_Processor.Manufacturer: AuthenticAMD / GenuineIntel */
  cpuVendor: string
  firmware: string // UEFI / Legacy
  secureBoot: number | null // registry UEFISecureBootEnabled
  tpm: { present: boolean; version: string } | null // null = couldn't read (needs admin)
  virtFirmware: boolean | null
  hypervisor: boolean
  chassis: number[]
  ram: { rated: number; configured: number; part: string; type: number }[]
  rebar: { bar1Mb: number; vramMb: number } | null // NVIDIA only
}

const LAPTOP_CHASSIS = new Set([8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32])

/** Common retail speeds that appear in memory part numbers (e.g. CMK16GX4M2B3200C16 → 3200). */
const SPEEDS = [2400, 2666, 2933, 3000, 3200, 3466, 3600, 3733, 3866, 4000, 4133, 4266, 4400, 4800, 5200, 5600, 6000, 6200, 6400, 6600, 6800, 7200, 7600, 8000, 8200]

/** The speed a kit is sold at, guessed from its part number. Pure, for tests. */
export function ratedFromPart(part: string): number | null {
  const nums = [...part.matchAll(/(\d{4})/g)].map((m) => Number(m[1])).filter((n) => SPEEDS.includes(n))
  return nums.length ? Math.max(...nums) : null
}

const ddr = (type: number) => (type === 34 ? 'DDR5' : type === 26 ? 'DDR4' : type === 24 ? 'DDR3' : 'RAM')

/** Builds the checklist from what Windows reports. Pure, for tests. */
export function buildChecks(f: RawFirmware, now = Date.now()): BiosCheck[] {
  const laptop = f.chassis.some((c) => LAPTOP_CHASSIS.has(c))
  // the option names depend on the CPU platform, not on the board name
  const amd = /amd/i.test(f.cpuVendor)
  const checks: BiosCheck[] = []

  // ---- memory profile (XMP / EXPO) ----
  const m = f.ram[0]
  if (!m || !m.configured) {
    checks.push({ id: 'xmp', title: 'Perfil de memória (XMP/EXPO)', status: 'unknown', detail: 'O Windows não informou a velocidade da memória.' })
  } else {
    const sold = ratedFromPart(m.part) ?? m.rated
    const kind = ddr(m.type)
    const profile = amd ? 'EXPO (ou DOCP)' : 'XMP'
    if (sold && m.configured + 50 < sold && !laptop)
      checks.push({
        id: 'xmp',
        title: 'Perfil de memória (XMP/EXPO)',
        status: 'action',
        detail: `Sua ${kind} está rodando a ${m.configured} MT/s, mas o módulo é vendido para ${sold} MT/s. Ativar o perfil costuma dar FPS mínimo mais estável.`,
        howTo: `Na BIOS, procure ${profile} em "AI Tweaker", "OC" ou "Memory" e escolha o Perfil 1.`
      })
    else
      checks.push({
        id: 'xmp',
        title: 'Perfil de memória (XMP/EXPO)',
        status: laptop && sold && m.configured < sold ? 'info' : 'ok',
        detail: laptop
          ? `${kind} a ${m.configured} MT/s. Em notebooks a velocidade é fixa pelo fabricante; não há perfil para ativar.`
          : `${kind} a ${m.configured} MT/s, a velocidade nominal do módulo.`
      })
  }

  // ---- Resizable BAR ----
  if (f.rebar) {
    const on = f.rebar.bar1Mb >= Math.min(f.rebar.vramMb * 0.9, 4096)
    checks.push({
      id: 'rebar',
      title: 'Resizable BAR',
      status: on ? 'ok' : laptop ? 'info' : 'action',
      detail: on
        ? 'Ativado: a CPU acessa toda a memória da placa de vídeo de uma vez.'
        : `Desativado (janela de ${f.rebar.bar1Mb} MB). Em muitos jogos atuais ativar dá alguns FPS a mais.`,
      howTo: on ? undefined : laptop ? 'Em notebooks só aparece se o fabricante liberou numa atualização de BIOS.' : 'Na BIOS, ative "Above 4G Decoding" e depois "Re-Size BAR Support" (normalmente em "PCI Subsystem" ou "Advanced").'
    })
  } else
    checks.push({ id: 'rebar', title: 'Resizable BAR', status: 'unknown', detail: 'O FpsBoost só consegue verificar em placas NVIDIA. Em AMD, o AMD Software mostra como "Smart Access Memory".' })

  // ---- Secure Boot / TPM (anti-cheats) ----
  checks.push(
    f.secureBoot === 1
      ? { id: 'secureboot', title: 'Secure Boot', status: 'ok', detail: 'Ativado. Alguns anti-cheats de jogos competitivos exigem isso.' }
      : f.secureBoot === 0
        ? {
            id: 'secureboot',
            title: 'Secure Boot',
            status: 'action',
            detail: 'Desativado. Alguns anti-cheats de jogos competitivos não deixam jogar sem ele.',
            howTo: 'Na BIOS, em "Boot" ou "Security", ative "Secure Boot" com as chaves padrão ("Standard" / "Install default keys"). O disco precisa estar em modo UEFI/GPT.'
          }
        : { id: 'secureboot', title: 'Secure Boot', status: 'unknown', detail: 'O Windows não informou o estado do Secure Boot.' }
  )
  checks.push(
    f.tpm == null
      ? { id: 'tpm', title: 'TPM 2.0', status: 'unknown', detail: 'Abra o FpsBoost como administrador para verificar o TPM.' }
      : f.tpm.present && f.tpm.version.startsWith('2')
        ? { id: 'tpm', title: 'TPM 2.0', status: 'ok', detail: 'Ativado. É exigido pelo Windows 11 e por alguns anti-cheats.' }
        : {
            id: 'tpm',
            title: 'TPM 2.0',
            status: 'action',
            detail: f.tpm.present ? `TPM ${f.tpm.version} encontrado; jogos e o Windows 11 pedem a versão 2.0.` : 'Desativado ou ausente.',
            howTo: amd ? 'Na BIOS, ative "AMD fTPM" (em "Advanced" > "AMD fTPM configuration").' : 'Na BIOS, ative "Intel PTT" (em "Advanced" > "PCH-FW Configuration").'
          }
  )

  // ---- firmware mode ----
  checks.push(
    /uefi/i.test(f.firmware)
      ? { id: 'uefi', title: 'Modo de inicialização', status: 'ok', detail: 'UEFI, o modo atual. Necessário para Secure Boot e Resizable BAR.' }
      : {
          id: 'uefi',
          title: 'Modo de inicialização',
          status: 'action',
          detail: 'Legado (CSM). Secure Boot e Resizable BAR só funcionam em UEFI.',
          howTo: 'Converter exige o disco em GPT: primeiro rode "mbr2gpt /convert /allowFullOS" no Windows, depois desative o CSM na BIOS. Faça backup antes.'
        }
  )

  // ---- virtualization ----
  const virt = f.hypervisor || f.virtFirmware === true
  checks.push({
    id: 'virtualization',
    title: 'Virtualização (VT-x / SVM)',
    status: 'info',
    detail: virt
      ? 'Ativada. Necessária para WSL, emuladores de Android e Hyper-V; não atrapalha jogos sozinha.'
      : 'Desativada. Só é necessária se você usa WSL, emuladores de Android ou máquinas virtuais.',
    howTo: virt ? undefined : 'Na BIOS, procure "SVM Mode" (AMD) ou "Intel Virtualization Technology" (Intel).'
  })

  // ---- BIOS age ----
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(f.biosDate)
  if (d) {
    const ageDays = Math.floor((now - Date.parse(`${d[1]}-${d[2]}-${d[3]}`)) / 86400000)
    const old = ageDays > 730
    checks.push({
      id: 'update',
      title: 'Atualização da BIOS',
      status: old ? 'action' : 'ok',
      detail: old
        ? `Sua BIOS é de ${d[3]}/${d[2]}/${d[1]}, com mais de 2 anos. Atualizações costumam trazer correções de estabilidade e de memória.`
        : `Versão de ${d[3]}/${d[2]}/${d[1]}.`,
      howTo: old ? 'Baixe a versão para o seu modelo exato na página de suporte do fabricante e siga as instruções dele. Não desligue o PC durante a atualização.' : undefined
    })
  }
  return checks
}

/** Support page for the board/laptop maker; falls back to a web search for the exact model. */
export function supportUrl(vendor: string, model: string): string {
  const v = vendor.toLowerCase()
  const q = encodeURIComponent(`${model}`.trim())
  if (v.includes('asus')) return `https://www.asus.com/support/searchresult/?searchType=support&searchKey=${q}`
  if (v.includes('micro-star') || v.startsWith('msi')) return `https://www.msi.com/search/${q}`
  if (v.includes('gigabyte')) return `https://www.gigabyte.com/Search?kw=${q}`
  if (v.includes('asrock')) return `https://www.asrock.com/support/index.asp?cat=BIOS`
  if (v.includes('lenovo')) return 'https://pcsupport.lenovo.com/'
  if (v.includes('dell')) return 'https://www.dell.com/support/home/'
  if (v.includes('hp') || v.includes('hewlett')) return 'https://support.hp.com/drivers'
  if (v.includes('acer')) return 'https://www.acer.com/br-pt/support'
  if (v.includes('razer')) return 'https://mysupport.razer.com/'
  return `https://www.google.com/search?q=${encodeURIComponent(`${vendor} ${model} BIOS download`.trim())}`
}

const SMI = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\nvidia-smi.exe`

async function readFirmware(): Promise<RawFirmware> {
  const r = await runPsJson<Omit<RawFirmware, 'rebar' | 'tpm' | 'ram'> & { tpmPresent: boolean | null; tpmVersion: string; ram: RawFirmware['ram'] | RawFirmware['ram'][number] | null }>(
    `$b = Get-CimInstance Win32_BIOS; $bb = Get-CimInstance Win32_BaseBoard; $cs = Get-CimInstance Win32_ComputerSystem
$tpm = try { Get-CimInstance -Namespace 'root/cimv2/security/microsofttpm' -ClassName Win32_Tpm -ErrorAction Stop } catch { $null }
[pscustomobject]@{
  biosVendor = [string]$b.Manufacturer; biosVersion = [string]$b.SMBIOSBIOSVersion
  biosDate = if ($b.ReleaseDate) { $b.ReleaseDate.ToString('yyyyMMdd') } else { '' }
  boardVendor = if ($bb.Manufacturer) { [string]$bb.Manufacturer } else { [string]$cs.Manufacturer }
  board = if ($bb.Product) { [string]$bb.Product } else { [string]$cs.Model }
  pcVendor = [string]$cs.Manufacturer; pcModel = [string]$cs.Model
  cpuVendor = [string](Get-CimInstance Win32_Processor | Select-Object -First 1).Manufacturer
  firmware = [string]$env:firmware_type
  secureBoot = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecureBoot\\State' -ErrorAction SilentlyContinue).UEFISecureBootEnabled
  tpmPresent = if ($tpm) { [bool]$tpm.IsEnabled_InitialValue } else { $null }
  tpmVersion = if ($tpm) { ([string]$tpm.SpecVersion -split ',')[0].Trim() } else { '' }
  virtFirmware = (Get-CimInstance Win32_Processor | Select-Object -First 1).VirtualizationFirmwareEnabled
  hypervisor = [bool]$cs.HypervisorPresent
  chassis = @((Get-CimInstance Win32_SystemEnclosure).ChassisTypes)
  ram = @(Get-CimInstance Win32_PhysicalMemory | % { [pscustomobject]@{ rated = [int]$_.Speed; configured = [int]$_.ConfiguredClockSpeed; part = ([string]$_.PartNumber).Trim(); type = [int]$_.SMBIOSMemoryType } })
}`,
    60_000
  )
  let rebar: RawFirmware['rebar'] = null
  if (existsSync(SMI)) {
    const q = await runPs(`& '${SMI}' -q -d MEMORY`, 15_000)
    // "FB Memory Usage ... Total : 8192 MiB" and "BAR1 Memory Usage ... Total : 256 MiB"
    const fb = /FB Memory Usage[\s\S]*?Total\s*:\s*(\d+)/i.exec(q.stdout)
    const bar = /BAR1 Memory Usage[\s\S]*?Total\s*:\s*(\d+)/i.exec(q.stdout)
    if (fb && bar) rebar = { bar1Mb: Number(bar[1]), vramMb: Number(fb[1]) }
  }
  const ram = r?.ram == null ? [] : Array.isArray(r.ram) ? r.ram : [r.ram]
  return {
    biosVendor: r?.biosVendor ?? '',
    biosVersion: r?.biosVersion ?? '',
    biosDate: r?.biosDate ?? '',
    boardVendor: r?.boardVendor ?? '',
    board: r?.board ?? '',
    pcVendor: r?.pcVendor ?? '',
    pcModel: r?.pcModel ?? '',
    cpuVendor: r?.cpuVendor ?? '',
    firmware: r?.firmware ?? '',
    secureBoot: r?.secureBoot ?? null,
    tpm: r?.tpmPresent == null ? null : { present: r.tpmPresent, version: r.tpmVersion },
    virtFirmware: r?.virtFirmware ?? null,
    hypervisor: !!r?.hypervisor,
    chassis: Array.isArray(r?.chassis) ? r!.chassis : r?.chassis != null ? [Number(r.chassis)] : [],
    ram,
    rebar
  }
}

const GENERIC_NAME = /system manufacturer|system product name|to be filled|default string|^\s*$/i
const BRANDED = /acer|lenovo|dell|alienware|hp|hewlett|asus|msi|micro-star|razer|samsung|gigabyte|avell|positivo/i

/**
 * Laptops and branded PCs are known (and supported) by the computer model, e.g. "Acer Nitro
 * AN515-46", not by the internal board code. Custom desktops keep the motherboard name. Pure, for tests.
 */
export function displayName(f: Pick<RawFirmware, 'pcVendor' | 'pcModel' | 'boardVendor' | 'board' | 'chassis'>): { maker: string; model: string } {
  const laptop = f.chassis.some((c) => LAPTOP_CHASSIS.has(c))
  const useSystem = !GENERIC_NAME.test(f.pcVendor) && !GENERIC_NAME.test(f.pcModel) && (laptop || BRANDED.test(f.pcVendor))
  return useSystem ? { maker: f.pcVendor, model: f.pcModel } : { maker: f.boardVendor, model: f.board }
}

export async function biosReport(): Promise<BiosReport> {
  const f = await readFirmware()
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(f.biosDate)
  const { maker, model } = displayName(f)
  return {
    vendor: f.biosVendor,
    version: f.biosVersion,
    date: d ? `${d[1]}-${d[2]}-${d[3]}` : undefined,
    board: model,
    boardVendor: maker,
    laptop: f.chassis.some((c) => LAPTOP_CHASSIS.has(c)),
    checks: buildChecks(f),
    supportUrl: supportUrl(maker, model)
  }
}
