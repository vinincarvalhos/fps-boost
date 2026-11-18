import { contextBridge, ipcRenderer } from 'electron'
import { INVOKE_CHANNELS, ON_CHANNELS, SEND_CHANNELS, type InvokeChannel, type OnChannel, type SendChannel } from '@shared/types'

const invokeAllowed = new Set<string>(INVOKE_CHANNELS)
const sendAllowed = new Set<string>(SEND_CHANNELS)
const onAllowed = new Set<string>(ON_CHANNELS)

const api = {
  invoke<T = unknown>(channel: InvokeChannel, ...args: unknown[]): Promise<T> {
    if (!invokeAllowed.has(channel)) return Promise.reject(new Error(`Canal não permitido: ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  send(channel: SendChannel): void {
    if (sendAllowed.has(channel)) ipcRenderer.send(channel)
  },
  /** Subscribes to a main-process event; returns the unsubscribe function. */
  on<T = unknown>(channel: OnChannel, cb: (payload: T) => void): () => void {
    if (!onAllowed.has(channel)) return () => undefined
    const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

export type FpsApi = typeof api

contextBridge.exposeInMainWorld('fps', api)
