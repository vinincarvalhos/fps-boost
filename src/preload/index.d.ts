import type { InvokeChannel, OnChannel, SendChannel } from '../shared/types'

declare global {
  interface Window {
    fps: {
      invoke<T = unknown>(channel: InvokeChannel, ...args: unknown[]): Promise<T>
      send(channel: SendChannel): void
      on<T = unknown>(channel: OnChannel, cb: (payload: T) => void): () => void
    }
  }
}

export {}
