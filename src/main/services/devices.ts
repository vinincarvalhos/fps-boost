import type { InputPrefs, MsiDevice, OpResult } from '@shared/types'
import { runPs, runPsJson } from './powershell'
import { store } from './store'

const q = (s: string) => s.replace(/'/g, "''")
const MSI_KEY = (id: string) => `HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\${id}\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties`

interface RawPci {
  id: string
  name: string
  cls: string
  msi: number | null
}

const KIND: Record<string, MsiDevice['kind']> = {
  Display: 'gpu',
  Net: 'network',
  USB: 'usb',
  MEDIA: 'audio',
  SCSIAdapter: 'storage',
  HDC: 'storage'
}

/** Maps raw PCI devices to the list shown in the app. Pure, for tests. */
export function toMsiDevices(raw: RawPci[], changed: string[]): MsiDevice[] {
  return raw
    .filter((d) => d.id.toUpperCase().startsWith('PCI\\') && KIND[d.cls])
    .map((d) => ({
      instanceId: d.id,
      name: d.name,
      kind: KIND[d.cls],
      msi: d.msi == null ? null : d.msi === 1,
      changedByApp: changed.includes(d.id)
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
}

export async function listMsiDevices(): Promise<MsiDevice[]> {
  const raw = await runPsJson<RawPci | RawPci[]>(
    `Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | ? { $_.InstanceId -like 'PCI\\*' -and $_.Class -in 'Display','Net','USB','MEDIA','SCSIAdapter','HDC' } | % {
  $k = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($_.InstanceId)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"
  $v = (Get-ItemProperty -Path $k -Name MSISupported -ErrorAction SilentlyContinue).MSISupported
  [pscustomobject]@{ id = $_.InstanceId; name = $_.FriendlyName; cls = [string]$_.Class; msi = $v }
}`,
    60_000
  )
  return toMsiDevices(raw == null ? [] : Array.isArray(raw) ? raw : [raw], store.get('msiChanged'))
}

/**
 * Turns MSI on. Turning it off is only allowed for devices FpsBoost turned on, and never for
 * storage controllers: a disk controller without the interrupt mode it boots with can stop Windows.
 */
export async function setMsi(instanceId: string, on: boolean): Promise<OpResult> {
  const dev = (await listMsiDevices()).find((d) => d.instanceId === instanceId)
  if (!dev) return { ok: false, error: 'Dispositivo não encontrado.' }
  if (!on && !dev.changedByApp) return { ok: false, error: 'O FpsBoost só desliga o modo MSI em dispositivos onde ele mesmo o ligou.' }
  if (!on && dev.kind === 'storage') return { ok: false, error: 'O modo MSI de controladores de disco não é desligado por segurança.' }
  const r = await runPs(
    `$k = '${q(MSI_KEY(instanceId))}'; New-Item -Path $k -Force | Out-Null; New-ItemProperty -Path $k -Name MSISupported -Value ${on ? 1 : 0} -PropertyType DWord -Force | Out-Null`
  )
  if (r.code !== 0) return { ok: false, error: r.stderr.split('\n')[0] || 'Não foi possível alterar.' }
  const changed = store.get('msiChanged').filter((x) => x !== instanceId)
  store.set('msiChanged', on ? [...changed, instanceId] : changed)
  return { ok: true }
}

// ---------- USB selective suspend (current power plan) ----------

const USB_SUB = '2a737441-1930-4402-8d77-b2bebba308a3'
const USB_SET = '48e6b7a6-50f5-4782-a5d4-53bb8f07e226'

async function usbSuspendValues(): Promise<{ ac: number; dc: number } | null> {
  const r = await runPs(`powercfg /q SCHEME_CURRENT ${USB_SUB} ${USB_SET}`)
  const hex = [...r.stdout.matchAll(/0x([0-9a-f]{8})/gi)].map((m) => parseInt(m[1], 16))
  // the last two hex values are the current AC and DC indexes, whatever the Windows language
  return hex.length >= 2 ? { ac: hex[hex.length - 2], dc: hex[hex.length - 1] } : null
}

export async function usbSuspendEnabled(): Promise<boolean | null> {
  const v = await usbSuspendValues()
  return v ? v.ac !== 0 || v.dc !== 0 : null
}

export async function setUsbSuspend(enabled: boolean): Promise<OpResult> {
  let ac = 0
  let dc = 0
  if (enabled) {
    const s = store.get('usbSuspendStash') ?? { ac: 1, dc: 1 }
    ac = s.ac
    dc = s.dc
  } else if (!store.get('usbSuspendStash')) {
    store.set('usbSuspendStash', (await usbSuspendValues()) ?? { ac: 1, dc: 1 })
  }
  const r = await runPs(
    `powercfg -setacvalueindex SCHEME_CURRENT ${USB_SUB} ${USB_SET} ${ac}; powercfg -setdcvalueindex SCHEME_CURRENT ${USB_SUB} ${USB_SET} ${dc}; powercfg -setactive SCHEME_CURRENT`
  )
  if (r.code !== 0) return { ok: false, error: 'Não foi possível alterar o plano de energia.' }
  if (enabled) store.set('usbSuspendStash', null)
  return { ok: true }
}

// ---------- mouse and keyboard ----------

const SPI = `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class Spi { [DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint a, uint b, System.IntPtr c, uint d); }'`

export const clampInput = (p: Partial<InputPrefs>) => ({
  mouseSpeed: p.mouseSpeed == null ? undefined : Math.min(20, Math.max(1, Math.round(p.mouseSpeed))),
  keyboardDelay: p.keyboardDelay == null ? undefined : Math.min(3, Math.max(0, Math.round(p.keyboardDelay))),
  keyboardSpeed: p.keyboardSpeed == null ? undefined : Math.min(31, Math.max(0, Math.round(p.keyboardSpeed)))
})

export async function inputPrefs(): Promise<InputPrefs> {
  const r = await runPsJson<{ ms: string; kd: string; ks: string; mice: string | string[] | null; kbs: string | string[] | null }>(
    `$m = Get-ItemProperty 'HKCU:\\Control Panel\\Mouse'; $k = Get-ItemProperty 'HKCU:\\Control Panel\\Keyboard'
[pscustomobject]@{ ms = [string]$m.MouseSensitivity; kd = [string]$k.KeyboardDelay; ks = [string]$k.KeyboardSpeed
  mice = @(Get-PnpDevice -Class Mouse -PresentOnly -ErrorAction SilentlyContinue | % FriendlyName)
  kbs = @(Get-PnpDevice -Class Keyboard -PresentOnly -ErrorAction SilentlyContinue | % FriendlyName) }`
  )
  const arr = (x: string | string[] | null | undefined) => [...new Set(x == null ? [] : Array.isArray(x) ? x : [x])]
  return {
    mouseSpeed: Number(r?.ms ?? 10) || 10,
    keyboardDelay: Number(r?.kd ?? 1),
    keyboardSpeed: Number(r?.ks ?? 31),
    mice: arr(r?.mice),
    keyboards: arr(r?.kbs)
  }
}

/** Applies immediately (SystemParametersInfo) and saves to the user profile. */
export async function setInputPrefs(patch: Partial<InputPrefs>): Promise<OpResult> {
  const c = clampInput(patch)
  const calls: string[] = []
  // SPIF_UPDATEINIFILE | SPIF_SENDCHANGE = 3
  if (c.mouseSpeed !== undefined) calls.push(`[void][Spi]::SystemParametersInfo(0x71, 0, [IntPtr]${c.mouseSpeed}, 3)`)
  if (c.keyboardDelay !== undefined) calls.push(`[void][Spi]::SystemParametersInfo(0x17, ${c.keyboardDelay}, [IntPtr]::Zero, 3)`)
  if (c.keyboardSpeed !== undefined) calls.push(`[void][Spi]::SystemParametersInfo(0x0B, ${c.keyboardSpeed}, [IntPtr]::Zero, 3)`)
  if (!calls.length) return { ok: true }
  const r = await runPs(`${SPI}\n${calls.join('\n')}`)
  return r.code === 0 ? { ok: true } : { ok: false, error: 'Não foi possível aplicar.' }
}
