import { useEffect, useState } from 'react'
import type { ProgressEvent } from '@shared/types'

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`
}

export const mb = (n: number) => bytes(n * 1024 * 1024)

/** Latest progress event for one kind of operation, or null when idle. */
export function useProgress(op: ProgressEvent['op']): ProgressEvent | null {
  const [p, setP] = useState<ProgressEvent | null>(null)
  useEffect(() => window.fps.on<ProgressEvent>('progress', (e) => e.op === op && setP(e)), [op])
  return p
}
