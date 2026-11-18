import { describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => process.cwd(), getPath: () => tmpdir() }, BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('electron-log/main', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
vi.mock('../src/main/services/store', () => ({ store: { get: () => [], set: () => {} }, logActivity: () => {} }))

import { buildNip, encodeNip, globalProfileFromBackup, NV_OPTIONS, parseSmi } from '../src/main/services/gpu'
import { clampInput, toMsiDevices } from '../src/main/services/devices'
import { toDriverInfo } from '../src/main/services/drivers'
import { median } from '../src/main/services/utilities'

describe('NVIDIA profile file', () => {
  it('uses the NVAPI ids and values from NvApiDriverSettings.h', () => {
    const byKey = Object.fromEntries(NV_OPTIONS.map((o) => [o.key, o]))
    expect(byKey.power).toMatchObject({ id: 0x1057eb71, value: 1 }) // PREFERRED_PSTATE_PREFER_MAX
    expect(byKey.vsync).toMatchObject({ id: 0x00a879cf, value: 0x08416747 }) // VSYNCMODE_FORCEOFF
    expect(byKey.texture).toMatchObject({ id: 0x00ce2691, value: 0x14 }) // QUALITY_ENHANCEMENTS_HIGHPERFORMANCE
    expect(byKey.vsync.recommended).toBe(false)
  })

  it('writes the global profile with decimal ids and Dword values', () => {
    const xml = buildNip(NV_OPTIONS.filter((o) => o.key === 'power' || o.key === 'vsync'))
    expect(xml).toContain('<Profiles>')
    expect(xml).toContain('<ProfileName />')
    expect(xml).toContain(`<SettingID>${0x1057eb71}</SettingID>`)
    expect(xml).toContain(`<SettingValue>${0x08416747}</SettingValue>`)
    expect(xml.match(/<ValueType>Dword<\/ValueType>/g)).toHaveLength(2)
  })

  it('encodes as UTF-16 LE with a BOM', () => {
    const b = encodeNip('<a/>')
    expect([...b.subarray(0, 4)]).toEqual([0xff, 0xfe, 0x3c, 0x00])
  })

  it('keeps only the global profile from a backup, or an empty one when it was not customized', () => {
    const backup = `<Profiles><Profile><ProfileName>Game X</ProfileName><Settings/></Profile><Profile><ProfileName /><Settings><ProfileSetting><SettingID>1</SettingID></ProfileSetting></Settings></Profile></Profiles>`
    const g = globalProfileFromBackup(backup)
    expect(g).not.toContain('Game X')
    expect(g).toContain('<SettingID>1</SettingID>')
    expect(globalProfileFromBackup('')).toContain('<Settings />')
  })
})

describe('nvidia-smi', () => {
  it('parses a csv line and treats N/A as unknown', () => {
    expect(parseSmi('NVIDIA GeForce RTX 3070 Ti Laptop GPU, 617.42, 52, 18, 1410, 7000, 35.20, 125.00, 1200, 8192, [N/A]')).toEqual({
      name: 'NVIDIA GeForce RTX 3070 Ti Laptop GPU',
      driver: '617.42',
      tempC: 52,
      loadPct: 18,
      coreMhz: 1410,
      memMhz: 7000,
      powerW: 35,
      powerLimitW: 125,
      vramUsedMb: 1200,
      vramTotalMb: 8192,
      fanPct: null
    })
    expect(parseSmi('garbage')).toBeNull()
  })
})

describe('devices', () => {
  it('keeps PCI devices of known classes and marks what the app changed', () => {
    const list = toMsiDevices(
      [
        { id: 'PCI\\VEN_10DE&DEV_1', name: 'RTX', cls: 'Display', msi: 1 },
        { id: 'PCI\\VEN_8086&DEV_2', name: 'Wi-Fi', cls: 'Net', msi: null },
        { id: 'USB\\VID_1', name: 'Mouse', cls: 'Mouse', msi: null },
        { id: 'PCI\\VEN_1&DEV_3', name: 'Bridge', cls: 'System', msi: 0 }
      ],
      ['PCI\\VEN_8086&DEV_2']
    )
    expect(list.map((d) => [d.kind, d.msi, d.changedByApp])).toEqual([
      ['gpu', true, false],
      ['network', null, true]
    ])
  })
  it('clamps mouse and keyboard values to Windows ranges', () => {
    expect(clampInput({ mouseSpeed: 99, keyboardDelay: -1, keyboardSpeed: 31.4 })).toEqual({ mouseSpeed: 20, keyboardDelay: 0, keyboardSpeed: 31 })
  })
})

describe('drivers', () => {
  it('maps classes, computes age and drops generic Microsoft system drivers', () => {
    const now = Date.parse('2026-11-18')
    const list = toDriverInfo(
      [
        { name: 'NVIDIA GeForce RTX 3070 Ti', cls: 'DISPLAY', provider: 'NVIDIA', version: '32.0.15.6174', date: '20260918000000.******+***' },
        { name: 'PCI bus', cls: 'SYSTEM', provider: 'Microsoft', version: '10.0', date: '20060621000000.******+***' },
        { name: 'AMD GPIO', cls: 'SYSTEM', provider: 'Advanced Micro Devices', version: '2.2', date: '' }
      ],
      now
    )
    expect(list.map((d) => d.name)).toEqual(['NVIDIA GeForce RTX 3070 Ti', 'AMD GPIO'])
    expect(list[0]).toMatchObject({ kind: 'Placa de vídeo', date: '2026-09-18', ageDays: 61 })
    expect(list[1].ageDays).toBeUndefined()
  })
  it("treats Windows inbox drivers' 2006 placeholder date as unknown", () => {
    const [d] = toDriverInfo([{ name: 'Bluetooth PAN', cls: 'NET', provider: 'Microsoft', version: '10.0', date: '20060620' }])
    expect(d).toMatchObject({ provider: 'Microsoft (incluído no Windows)', ageDays: undefined })
    expect(toDriverInfo([{ name: 'Microsoft Kernel Debug Network Adapter', cls: 'NET', provider: 'Microsoft', version: '1', date: '' }])).toHaveLength(0)
  })
})

describe('dns', () => {
  it('median', () => {
    expect(median([30, 10, 20])).toBe(20)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})
