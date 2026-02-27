import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export interface SSHConfig {
  host: string
  port: number
  username: string
  privateKeyPath: string
  remotePort: number
}

export interface FileReadResult {
  name: string
  mimeType: string
  base64: string
  size: number
}

export interface SSHConnectResult {
  success: boolean
  localPort?: number
  error?: string
}

export const api = {
  store: {
    get: (key: string): Promise<unknown> =>
      invoke<unknown>('store_get', { key }),
    set: (key: string, value: unknown): Promise<void> =>
      invoke<void>('store_set', { key, value }),
    delete: (key: string): Promise<void> =>
      invoke<void>('store_delete', { key }),
  },
  dialog: {
    openFile: (): Promise<string[]> =>
      open({
        multiple: true,
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
          { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'json', 'csv'] },
          { name: 'Code', extensions: ['js', 'ts', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      }).then((result) => {
        if (!result) return []
        return Array.isArray(result) ? (result as string[]) : [result as string]
      }),
  },
  file: {
    read: (path: string): Promise<FileReadResult> =>
      invoke<FileReadResult>('file_read', { path }),
  },
  ssh: {
    connect: (config: SSHConfig): Promise<SSHConnectResult> =>
      invoke<SSHConnectResult>('ssh_connect', { config }),
    disconnect: (): Promise<void> =>
      invoke<void>('ssh_disconnect'),
  },
}
