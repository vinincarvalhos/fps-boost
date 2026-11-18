import { create } from 'zustand'
import type { LiveStats, SystemInfo } from '@shared/types'

const HISTORY = 60 // readings kept for the sparklines (~90s)

interface LiveState {
  info: SystemInfo | null
  current: LiveStats | null
  cpu: number[]
  gpu: number[]
  ram: number[]
}

/**
 * App-wide live readings. Polling starts once and keeps running across pages,
 * so the history graphs are already filled when you come back to the dashboard.
 */
export const useLive = create<LiveState>(() => ({ info: null, current: null, cpu: [], gpu: [], ram: [] }))

const push = (arr: number[], v: number | null) => (v == null ? arr : [...arr, v].slice(-HISTORY))

let started = false
export function startLivePolling(intervalMs = 1500): void {
  if (started) return
  started = true
  window.fps.invoke<SystemInfo>('system:info').then((info) => useLive.setState({ info }))
  const tick = async () => {
    // nobody is looking (minimized, in the tray or behind a game): no readings at all
    if (document.hidden) {
      document.addEventListener('visibilitychange', tick, { once: true })
      return
    }
    try {
      const s = await window.fps.invoke<LiveStats>('system:live')
      useLive.setState((st) => ({
        // nvidia-smi occasionally misses a reading; keep the last good GPU value instead of flashing "—"
        current: { ...s, gpuLoad: s.gpuLoad ?? st.current?.gpuLoad ?? null, gpuTemp: s.gpuTemp ?? st.current?.gpuTemp ?? null },
        cpu: push(st.cpu, s.cpuLoad),
        gpu: push(st.gpu, s.gpuLoad),
        ram: push(st.ram, s.memUsedPct)
      }))
    } catch {
      /* keep last reading */
    }
    // chained timeout: a slow reading never stacks up behind another
    setTimeout(tick, intervalMs)
  }
  tick()
}
