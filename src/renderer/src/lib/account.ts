import { create } from 'zustand'
import type { LicenseResult, LicenseState, UpdaterState } from '@shared/types'

interface AccountState {
  license: LicenseState
  updater: UpdaterState | null
  /** true while the "this is a Premium feature" dialog is open */
  upsellOpen: boolean
  openUpsell: () => void
  closeUpsell: () => void
  activate: (key: string) => Promise<LicenseResult>
  deactivate: () => Promise<LicenseResult>
}

export const useAccount = create<AccountState>((set) => ({
  license: { plan: 'free', status: 'none' },
  updater: null,
  upsellOpen: false,
  openUpsell: () => set({ upsellOpen: true }),
  closeUpsell: () => set({ upsellOpen: false }),
  activate: async (key) => {
    const res = await window.fps.invoke<LicenseResult>('license:activate', key)
    set({ license: res.state })
    return res
  },
  deactivate: async () => {
    const res = await window.fps.invoke<LicenseResult>('license:deactivate')
    set({ license: res.state })
    return res
  }
}))

export const usePremium = () => useAccount((s) => s.license.plan === 'premium')

let started = false
/** Loads license/update state once and follows the main process's change events. */
export function startAccountSync(): void {
  if (started) return
  started = true
  window.fps.invoke<LicenseState>('license:status').then((license) => useAccount.setState({ license }))
  window.fps.invoke<UpdaterState>('updater:state').then((updater) => useAccount.setState({ updater }))
  window.fps.on<LicenseState>('license:changed', (license) => useAccount.setState({ license }))
  window.fps.on<UpdaterState>('updater:changed', (updater) => useAccount.setState({ updater }))
}
