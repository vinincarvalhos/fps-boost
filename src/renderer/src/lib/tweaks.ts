import { create } from 'zustand'
import type { TweakMeta, TweakResult } from '@shared/types'
import { toast } from './toast'

interface TweakState {
  list: TweakMeta[]
  states: Record<string, boolean>
  loading: boolean
  busy: Set<string>
  needsRestart: boolean
  load: () => Promise<void>
  run: (t: TweakMeta, apply: boolean) => Promise<boolean>
}

let loadPromise: Promise<void> | null = null

/** Shared by the dashboard and the tweaks page so the system is only scanned once. */
export const useTweaks = create<TweakState>((set, get) => ({
  list: [],
  states: {},
  loading: true,
  busy: new Set(),
  needsRestart: false,

  load: () => {
    loadPromise ??= Promise.all([
      window.fps.invoke<TweakMeta[]>('tweaks:list'),
      window.fps.invoke<Record<string, boolean>>('tweaks:states')
    ])
      .then(([list, states]) => set({ list, states }))
      .finally(() => set({ loading: false }))
    return loadPromise
  },

  run: async (t, apply) => {
    set((s) => ({ busy: new Set(s.busy).add(t.id) }))
    try {
      const res = await window.fps.invoke<TweakResult>(apply ? 'tweaks:apply' : 'tweaks:unapply', t.id)
      if (!res.ok) {
        toast.error(`${t.title} não foi ${apply ? 'aplicado' : 'revertido'}.\n${res.error ?? ''}`.trim())
        return false
      }
      set((s) => ({ states: { ...s.states, [t.id]: apply }, needsRestart: s.needsRestart || !!t.restart }))
      toast.ok(apply ? `${t.title}: aplicado` : `${t.title}: revertido`)
      return true
    } finally {
      set((s) => {
        const busy = new Set(s.busy)
        busy.delete(t.id)
        return { busy }
      })
    }
  }
}))

/** Category order; anything else goes last, alphabetically. */
export const CATEGORY_ORDER = ['Desempenho', 'Jogos', 'Rede', 'Privacidade', 'Interface', 'Sistema']

export function categoryOf(t: TweakMeta): string {
  return t.category[0] ?? 'Sistema'
}

export function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })
}

/** Tweaks that need a confirmation dialog before applying. */
export function needsConfirm(t: TweakMeta): boolean {
  return !!t.confirm || t.risk === 'caution' || !t.reversible
}
