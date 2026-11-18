import { describe, expect, it, vi } from 'vitest'

vi.mock('electron-log/main', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))

import { buildChecks, displayName, ratedFromPart, supportUrl, type RawFirmware } from '../src/main/services/bios'

const base: RawFirmware = {
  biosVendor: 'American Megatrends Inc.',
  biosVersion: '1.20',
  biosDate: '20260301',
  boardVendor: 'ASUSTeK COMPUTER INC.',
  board: 'ROG STRIX B650-A GAMING WIFI',
  pcVendor: 'System manufacturer',
  pcModel: 'System Product Name',
  cpuVendor: 'AuthenticAMD',
  firmware: 'UEFI',
  secureBoot: 1,
  tpm: { present: true, version: '2.0' },
  virtFirmware: true,
  hypervisor: false,
  chassis: [3], // desktop
  ram: [{ rated: 4800, configured: 4800, part: 'CMK32GX5M2B6000C30', type: 34 }],
  rebar: { bar1Mb: 16384, vramMb: 16384 }
}
const now = Date.parse('2026-11-18')
const byId = (f: RawFirmware) => Object.fromEntries(buildChecks(f, now).map((c) => [c.id, c]))

describe('memory part numbers', () => {
  it('reads the sold speed from common part numbers', () => {
    expect(ratedFromPart('CMK16GX4M2B3200C16')).toBe(3200)
    expect(ratedFromPart('CMK32GX5M2B6000C30')).toBe(6000)
    expect(ratedFromPart('M425R1GB4BB0-CQKOL')).toBeNull()
  })
})

describe('BIOS checklist', () => {
  it('asks to enable XMP/EXPO when a desktop kit runs below its sold speed', () => {
    const c = byId(base)
    expect(c.xmp.status).toBe('action')
    expect(c.xmp.detail).toContain('4800')
    expect(c.xmp.detail).toContain('6000')
    expect(c.xmp.howTo).toContain('EXPO')
    expect(byId({ ...base, cpuVendor: 'GenuineIntel' }).xmp.howTo).toContain('XMP')
  })

  it('never asks a laptop to enable XMP', () => {
    expect(byId({ ...base, chassis: [10] }).xmp.status).not.toBe('action')
  })

  it('is happy when memory runs at its sold speed', () => {
    expect(byId({ ...base, ram: [{ rated: 4800, configured: 6000, part: 'CMK32GX5M2B6000C30', type: 34 }] }).xmp.status).toBe('ok')
  })

  it('detects Resizable BAR from the NVIDIA BAR1 size', () => {
    expect(byId(base).rebar.status).toBe('ok')
    expect(byId({ ...base, rebar: { bar1Mb: 256, vramMb: 8192 } }).rebar.status).toBe('action')
    expect(byId({ ...base, rebar: null }).rebar.status).toBe('unknown')
  })

  it('flags Secure Boot off, unknown TPM, legacy boot and old firmware', () => {
    const c = byId({ ...base, secureBoot: 0, tpm: null, firmware: 'Legacy', biosDate: '20220110' })
    expect(c.secureboot.status).toBe('action')
    expect(c.tpm.status).toBe('unknown')
    expect(c.uefi.status).toBe('action')
    expect(c.update.status).toBe('action')
  })

  it('suggests fTPM on AMD boards and PTT on Intel boards', () => {
    expect(byId({ ...base, tpm: { present: false, version: '' } }).tpm.howTo).toContain('fTPM')
    expect(byId({ ...base, cpuVendor: 'GenuineIntel', board: 'PRIME Z790-P', tpm: { present: false, version: '' } }).tpm.howTo).toContain('PTT')
  })
})

describe('display name', () => {
  it('uses the computer model for laptops, the board for custom desktops', () => {
    expect(displayName({ pcVendor: 'Acer', pcModel: 'Nitro AN515-46', boardVendor: 'RB', board: 'Jimny_RBH', chassis: [10] })).toEqual({ maker: 'Acer', model: 'Nitro AN515-46' })
    expect(displayName({ pcVendor: 'System manufacturer', pcModel: 'System Product Name', boardVendor: 'ASUSTeK', board: 'ROG STRIX B650-A', chassis: [3] })).toEqual({ maker: 'ASUSTeK', model: 'ROG STRIX B650-A' })
  })
})

describe('support page', () => {
  it('links to the maker or falls back to a search', () => {
    expect(supportUrl('ASUSTeK COMPUTER INC.', 'ROG STRIX B650-A')).toContain('asus.com')
    expect(supportUrl('Micro-Star International Co., Ltd.', 'MAG B550')).toContain('msi.com')
    expect(supportUrl('RB', 'Jimny_RBH')).toMatch(/^https:\/\/www\.google\.com\/search\?q=RB%20Jimny_RBH/)
  })
})
