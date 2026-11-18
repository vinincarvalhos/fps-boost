import { ipcMain } from 'electron'
import os from 'node:os'
import si from 'systeminformation'
import type { LiveStats, SystemInfo } from '@shared/types'

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
 * si.graphics() shells out to nvidia-smi / WMI and takes ~1.5s, so it refreshes in the
 * background and live readings always return the cached value without waiting.
 */
function gpuStats(): { load: number | null; temp: number | null } {
  if (!gpuRefreshing && Date.now() - gpuCache.at > 2000) {
    gpuRefreshing = true
    si.graphics()
      .then((g) => {
        const main = g.controllers.find((c) => c.utilizationGpu != null) ?? g.controllers[0]
        gpuCache = { load: main?.utilizationGpu ?? gpuCache.load, temp: main?.temperatureGpu ?? gpuCache.temp, at: Date.now() }
      })
      .catch(() => (gpuCache = { ...gpuCache, at: Date.now() }))
      .finally(() => (gpuRefreshing = false))
  }
  return gpuCache
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
  const [load, mem, temp, gpu, disk] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.cpuTemperature().catch(() => ({ main: null })),
    gpuStats(),
    diskStats()
  ])
  return {
    cpuLoad: Math.round(load.currentLoad),
    cpuTemp: temp.main && temp.main > 0 ? Math.round(temp.main) : null,
    memUsedPct: Math.round((mem.active / mem.total) * 100),
    memUsedGb: +(mem.active / GB).toFixed(1),
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
