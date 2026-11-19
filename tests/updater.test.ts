import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false, getVersion: () => '0.1.1' }, BrowserWindow: { getAllWindows: () => [] }, Notification: { isSupported: () => false } }))
vi.mock('electron-log/main', () => ({ default: { info: () => {}, warn: () => {}, error: () => {} } }))
vi.mock('electron-updater', () => ({ default: { autoUpdater: {} } }))
vi.mock('../src/main/services/store', () => ({ store: { get: () => null, set: () => {} } }))

import { isNewer } from '../src/main/services/updater'

describe('version comparison', () => {
  it('compares each part as a number', () => {
    expect(isNewer('0.1.2', '0.1.1')).toBe(true)
    expect(isNewer('0.1.10', '0.1.9')).toBe(true)
    expect(isNewer('1.0.0', '0.9.9')).toBe(true)
    expect(isNewer('0.1.1', '0.1.1')).toBe(false)
    expect(isNewer('0.1.0', '0.1.1')).toBe(false)
  })
})
