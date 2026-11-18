import { create } from 'zustand'

export interface Toast {
  id: number
  kind: 'ok' | 'error'
  text: string
}

interface ToastState {
  toasts: Toast[]
  push: (kind: Toast['kind'], text: string) => void
  dismiss: (id: number) => void
}

let seq = 0

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 8000 : 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

export const toast = {
  ok: (text: string) => useToasts.getState().push('ok', text),
  error: (text: string) => useToasts.getState().push('error', text)
}
