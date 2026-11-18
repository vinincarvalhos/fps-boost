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

async function gpuStats(): Promise<{ load: number | null; temp: number | null }> {
  // si.graphics() shells out to nvidia-smi / WMI and is slow; refresh at most every 4s.
  if (Date.now() - gpuCache.at < 4000) return gpuCache
  try {
    const g = await si.graphics()
    const main = g.controllers.find((c) => c.utilizationGpu != null) ?? g.controllers[0]
    gpuCache = {
      load: main?.utilizationGpu ?? null,
      temp: main?.temperatureGpu ?? null,
      at: Date.now()
    }
  } catch {
    gpuCache = { ...gpuCache, at: Date.now() }
  }
  return gpuCache
}

async function collectLive(): Promise<LiveStats> {
  const [load, mem, temp, gpu] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.cpuTemperature().catch(() => ({ main: null })),
    gpuStats()
  ])
  return {
    cpuLoad: Math.round(load.currentLoad),
    cpuTemp: temp.main && temp.main > 0 ? Math.round(temp.main) : null,
    memUsedPct: Math.round((mem.active / mem.total) * 100),
    memUsedGb: +(mem.active / GB).toFixed(1),
    gpuLoad: gpu.load,
    gpuTemp: gpu.temp,
    diskActivityPct: null
  }
}

export function registerSystemIpc(): void {
  ipcMain.handle('system:info', async () => {
    if (!cachedInfo) cachedInfo = await collectInfo()
    return cachedInfo
  })
  ipcMain.handle('system:live', () => collectLive())
}
