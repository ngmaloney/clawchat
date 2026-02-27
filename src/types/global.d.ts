export {}

export interface SSHConfig {
  host: string
  port: number
  username: string
  privateKeyPath: string
  remotePort: number
}

// Window.api is no longer used — IPC is handled via tauri-bridge.ts
