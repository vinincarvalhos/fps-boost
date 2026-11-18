import { ipcMain, shell } from 'electron'
import { spawn } from 'node:child_process'
import si from 'systeminformation'
import type { InputPrefs } from '@shared/types'
import { inputPrefs, listMsiDevices, setInputPrefs, setMsi, setUsbSuspend, usbSuspendEnabled } from '../services/devices'
import { installDriverUpdates, listDrivers, searchDriverUpdates, VENDOR_PAGES } from '../services/drivers'
import { amdSoftwarePath, applyNvidia, downloadNpi, gpuMetrics, gpuState, NPI, NV_OPTIONS, restoreNvidia } from '../services/gpu'
import { isPremium } from '../services/license'
import { logActivity } from '../services/store'
import { applyDns, benchmarkDns, flushDns, listVolumes, optimizeVolume, resetNetwork } from '../services/utilities'

const PREMIUM = 'O otimizador da placa de vídeo faz parte do plano Premium. Ative sua chave em Licença.'
const running = new Set<string>()
async function once<T>(kind: string, busy: T, job: () => Promise<T>): Promise<T> {
  if (running.has(kind)) return busy
  running.add(kind)
  try {
    return await job()
  } finally {
    running.delete(kind)
  }
}
const BUSY = { ok: false, error: 'Já existe uma operação desse tipo em andamento.' }

async function mainGpu() {
  const g = await si.graphics()
  const list = g.controllers.filter((c) => !/basic display|remote/i.test(c.model))
  // the discrete card when there is one
  return list.find((c) => /nvidia|amd|radeon/i.test(`${c.vendor} ${c.model}`) && (c.vram ?? 0) >= 1024) ?? list[0]
}

export function registerPhase5Ipc(): void {
  // ---- GPU ----
  ipcMain.handle('gpu:state', async () => {
    const g = await mainGpu()
    return gpuState(g?.model ?? 'Placa de vídeo', g?.vendor ?? '', g?.driverVersion)
  })
  ipcMain.handle('gpu:metrics', () => gpuMetrics())
  ipcMain.handle('gpu:options', () => ({ options: NV_OPTIONS, npi: { version: NPI.version, sizeKb: NPI.sizeKb, url: 'https://github.com/Orbmu2k/nvidiaProfileInspector' } }))
  ipcMain.handle('gpu:download-npi', () => once('npi', BUSY, () => downloadNpi()))
  ipcMain.handle('gpu:apply', (_e, keys: unknown) =>
    once('gpu', BUSY, async () => {
      if (!isPremium()) return { ok: false, error: PREMIUM }
      const r = await applyNvidia(Array.isArray(keys) ? keys.map(String) : [])
      if (r.ok) logActivity({ kind: 'applied', title: `Placa de vídeo: ${r.done} configurações da NVIDIA` })
      return r
    })
  )
  ipcMain.handle('gpu:restore', () => once('gpu', BUSY, () => restoreNvidia()))
  ipcMain.handle('gpu:open-amd', () => {
    const p = amdSoftwarePath()
    if (p) spawn(p, [], { detached: true, stdio: 'ignore' }).unref()
    else shell.openExternal(VENDOR_PAGES.amd)
  })

  // ---- devices ----
  ipcMain.handle('devices:msi', () => listMsiDevices())
  ipcMain.handle('devices:set-msi', (_e, id: string, on: boolean) => setMsi(String(id), !!on))
  ipcMain.handle('devices:usb-suspend', () => usbSuspendEnabled())
  ipcMain.handle('devices:set-usb-suspend', (_e, enabled: boolean) => setUsbSuspend(!!enabled))
  ipcMain.handle('devices:input', () => inputPrefs())
  ipcMain.handle('devices:set-input', (_e, patch: Partial<InputPrefs>) => setInputPrefs(patch ?? {}))

  // ---- drivers ----
  ipcMain.handle('drivers:list', () => listDrivers())
  ipcMain.handle('drivers:search', () => once('wu-search', { ok: false, updates: [], error: BUSY.error }, () => searchDriverUpdates()))
  ipcMain.handle('drivers:install', (_e, ids: unknown) =>
    once('wu-install', BUSY, async () => {
      const r = await installDriverUpdates(Array.isArray(ids) ? ids.map(String) : [])
      if (r.done) logActivity({ kind: 'applied', title: `${r.done} driver(s) atualizado(s)` })
      return r
    })
  )
  ipcMain.handle('drivers:vendor-page', (_e, vendor: keyof typeof VENDOR_PAGES) => {
    if (VENDOR_PAGES[vendor]) shell.openExternal(VENDOR_PAGES[vendor])
  })

  // ---- utilities ----
  ipcMain.handle('utils:dns-benchmark', () => once('dns', [], () => benchmarkDns()))
  ipcMain.handle('utils:dns-apply', (_e, id: string) => applyDns(String(id)))
  ipcMain.handle('utils:volumes', () => listVolumes())
  ipcMain.handle('utils:optimize', (_e, letter: string) => once(`opt-${letter}`, BUSY, () => optimizeVolume(String(letter))))
  ipcMain.handle('utils:flush-dns', () => flushDns())
  ipcMain.handle('utils:reset-network', () => resetNetwork())
}
