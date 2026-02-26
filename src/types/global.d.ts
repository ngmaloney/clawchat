export {}

export interface SSHConfig {
  host: string
  port: number
  username: string
  privateKeyPath: string
  remotePort: number
}

declare global {
  interface Window {
    api: {
      store: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
        delete: (key: string) => Promise<void>
      }
      dialog: {
        openFile: () => Promise<string[]>
      }
      file: {
        read: (path: string) => Promise<{
          name: string
          mimeType: string
          base64: string
          size: number
        }>
      }
      ssh: {
        connect: (config: SSHConfig) => Promise<{ success: boolean; localPort?: number; error?: string }>
        disconnect: () => Promise<void>
      }
    }
  }
}
