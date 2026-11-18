import { contextBridge, ipcRenderer } from 'electron'
import { INVOKE_CHANNELS, SEND_CHANNELS, type InvokeChannel, type SendChannel } from '@shared/types'

const invokeAllowed = new Set<string>(INVOKE_CHANNELS)
const sendAllowed = new Set<string>(SEND_CHANNELS)

const api = {
  invoke<T = unknown>(channel: InvokeChannel, ...args: unknown[]): Promise<T> {
    if (!invokeAllowed.has(channel)) return Promise.reject(new Error(`Canal não permitido: ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  send(channel: SendChannel): void {
    if (sendAllowed.has(channel)) ipcRenderer.send(channel)
  }
}

export type FpsApi = typeof api

contextBridge.exposeInMainWorld('fps', api)
