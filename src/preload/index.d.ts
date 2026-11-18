import type { InvokeChannel, SendChannel } from '../shared/types'

declare global {
  interface Window {
    fps: {
      invoke<T = unknown>(channel: InvokeChannel, ...args: unknown[]): Promise<T>
      send(channel: SendChannel): void
    }
  }
}

export {}
