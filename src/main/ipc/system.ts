import { ipcMain } from 'electron'
import os from 'node:os'
import si from 'systeminformation'
import type { LiveStats, SystemInfo } from '@shared/types'
import { gameModeState } from '../services/gamemode'
import { gpuMetrics } from '../services/gpu'

const GB = 1024 ** 3
let cachedInfo: SystemInfo | null = null

async function collectInfo(): Promise<SystemInfo> {
  const [osInfo, cpu, gfx, mem, layout, disks, board] = await Promise.all([
    si.osInfo(),
    si.cpu(),
    si.graphics(),
    si.mem(),
    si.memLayout(),
    si.diskLayout(),
    si.baseboard()
  ])
  return {
    os: {
      distro: osInfo.distro,
      release: osInfo.release,
      build: osInfo.build,
      hostname: osInfo.hostname,
      user: os.userInfo().username
    },
    cpu: {
      brand: cpu.brand,
      manufacturer: cpu.manufacturer,
      cores: cpu.physicalCores,
      threads: cpu.cores,
      speedGhz: cpu.speedMax || cpu.speed
    },
    gpus: gfx.controllers
      .filter((c) => !/basic display|remote/i.test(c.model))
      .map((c) => ({
        model: c.model,
        vendor: c.vendor,
        vramMb: c.vram ?? 0,
        driver: c.driverVersion
      })),
    memory: {
      totalGb: layout.reduce((s, m) => s + m.size, 0) > 0 ? Math.round(layout.reduce((s, m) => s + m.size, 0) / GB) : Math.round(mem.total / GB),
      modules: layout
        .filter((m) => m.size > 0)
        .map((m) => ({ sizeGb: Math.round(m.size / GB), speedMhz: m.clockSpeed ?? 0, type: m.type }))
    },
    disks: disks.map((d) => ({
      name: d.name,
      type: d.interfaceType === 'NVMe' ? 'NVMe' : d.type,
      sizeGb: Math.round(d.size / 1e9)
    })),
    board: { manufacturer: board.manufacturer, model: board.model }
  }
}

let gpuCache: { load: number | null; temp: number | null; at: number } = { load: null, temp: null, at: 0 }
let gpuRefreshing = false

/**
 * GPU load/temperature straight from nvidia-smi (one small process, no PowerShell or WMI),
 * refreshed in the background every 3s; without an NVIDIA GPU it only retries every minute.
 */
function gpuStats(): { load: number | null; temp: number | null } {
  const wait = gpuCache.at && gpuCache.load == null && gpuCache.temp == null ? 60_000 : 3000
  if (!gpuRefreshing && Date.now() - gpuCache.at > wait) {
    gpuRefreshing = true
    gpuMetrics()
      .then((m) => (gpuCache = { load: m?.loadPct ?? null, temp: m?.tempC ?? null, at: Date.now() }))
      .catch(() => (gpuCache = { ...gpuCache, at: Date.now() }))
      .finally(() => (gpuRefreshing = false))
  }
  return gpuCache
}

let tempCache: { value: number | null; at: number } = { value: null, at: 0 }
let tempRefreshing = false

/**
 * CPU temperature comes from a WMI query (a PowerShell process plus WmiPrvSE work), which can
 * cause hitches in games. So it refreshes at most every 30s and never while Game mode is on.
 */
function cpuTemp(): number | null {
  if (!tempRefreshing && !gameModeState().active && Date.now() - tempCache.at > 30_000) {
    tempRefreshing = true
    si.cpuTemperature()
      .then((t) => (tempCache = { value: t.main && t.main > 0 ? Math.round(t.main) : null, at: Date.now() }))
      .catch(() => (tempCache = { ...tempCache, at: Date.now() }))
      .finally(() => (tempRefreshing = false))
  }
  return tempCache.value
}

let diskCache: { value: LiveStats['disk']; at: number } = { value: null, at: 0 }

/** System drive usage; changes slowly, so refreshed every 30s. */
async function diskStats(): Promise<LiveStats['disk']> {
  if (Date.now() - diskCache.at < 30_000) return diskCache.value
  try {
    const drive = (process.env.SystemDrive ?? 'C:').toUpperCase()
    const fs = (await si.fsSize()).find((f) => f.mount.toUpperCase() === drive)
    diskCache = {
      value: fs ? { usedPct: Math.round(fs.use), freeGb: Math.round(fs.available / GB), totalGb: Math.round(fs.size / GB) } : null,
      at: Date.now()
    }
  } catch {
    diskCache = { ...diskCache, at: Date.now() }
  }
  return diskCache.value
}

async function collectLive(): Promise<LiveStats> {
  // si.currentLoad reads os.cpus() and RAM comes from os: neither starts a process
  const [load, disk] = await Promise.all([si.currentLoad(), diskStats()])
  const total = os.totalmem()
  const used = total - os.freemem()
  const gpu = gpuStats()
  return {
    cpuLoad: Math.round(load.currentLoad),
    cpuTemp: cpuTemp(),
    memUsedPct: Math.round((used / total) * 100),
    memUsedGb: +(used / GB).toFixed(1),
    gpuLoad: gpu.load,
    gpuTemp: gpu.temp,
    disk
  }
}

export function registerSystemIpc(): void {
  ipcMain.handle('system:info', async () => {
    if (!cachedInfo) cachedInfo = await collectInfo()
    return cachedInfo
  })
  ipcMain.handle('system:live', () => collectLive())
}
