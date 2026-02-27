import { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import Store from 'electron-store'
import contextMenu from 'electron-context-menu'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Persistent config store (lazy init)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let store: Store<any> | null = null

function getStore() {
  if (!store) {
    store = new Store({
      name: 'clawchat-config',
      defaults: {
        gatewayUrl: 'ws://localhost:18789',
        token: '',
      },
    })
    console.log('[Main] Config store initialized at:', store.path)
  }
  return store
}

// IPC handlers for store access
ipcMain.handle('store:get', (_event, key: string) => {
  return getStore().get(key)
})

ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
  getStore().set(key, value)
})

ipcMain.handle('store:delete', (_event, key: string) => {
  getStore().delete(key as any)
})

// File dialog handler
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
      { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'json', 'csv'] },
      { name: 'Code', extensions: ['js', 'ts', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.filePaths
})

// File read handler
ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    const buffer = await fs.readFile(filePath)
    const base64 = buffer.toString('base64')
    const stats = await fs.stat(filePath)
    const name = path.basename(filePath)
    
    // Simple mime type detection by extension
    const ext = path.extname(filePath).toLowerCase().slice(1)
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      csv: 'text/csv',
      js: 'text/javascript',
      ts: 'text/typescript',
      py: 'text/x-python',
      rs: 'text/x-rust',
      go: 'text/x-go',
      java: 'text/x-java',
      c: 'text/x-c',
      cpp: 'text/x-c++',
      h: 'text/x-c',
    }
    const mimeType = mimeMap[ext] || 'application/octet-stream'

    return {
      name,
      mimeType,
      base64,
      size: stats.size,
    }
  } catch (error) {
    console.error('[Main] Failed to read file:', error)
    throw error
  }
})

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// ─── SSH Tunnel ────────────────────────────────────────────────────────────
// Uses the system `ssh` binary (same as terminal) instead of a JS SSH
// implementation — avoids native module issues and routing quirks.

export interface SSHConfig {
  host: string
  port: number
  username: string
  privateKeyPath: string
  remotePort: number
}

let sshProcess: ChildProcess | null = null

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

function destroySSHTunnel(): Promise<void> {
  return new Promise((resolve) => {
    if (!sshProcess) { resolve(); return }
    const proc = sshProcess
    sshProcess = null
    proc.kill()
    proc.once('exit', () => resolve())
    setTimeout(resolve, 1000) // force resolve after 1s if process hangs
  })
}

function createSSHTunnel(config: SSHConfig): Promise<number> {
  return destroySSHTunnel().then(() => getAvailablePort()).then((localPort) => new Promise((resolve, reject) => {
    const keyPath = (config.privateKeyPath || '~/.ssh/id_rsa').replace(/^~/, os.homedir())

    const args = [
      '-N',                                     // no remote command
      '-o', 'StrictHostKeyChecking=accept-new', // TOFU — accept new, reject changed
      '-o', 'ExitOnForwardFailure=yes',         // fail fast if port forward fails
      '-o', 'ServerAliveInterval=30',           // keep-alive
      '-o', 'BatchMode=yes',                    // no interactive prompts
      '-L', `${localPort}:127.0.0.1:${config.remotePort}`,
      '-p', String(config.port || 22),
      '-i', keyPath,
      `${config.username}@${config.host}`,
    ]

    const proc = spawn('ssh', args, { stdio: 'pipe' })
    sshProcess = proc

    let stderr = ''
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('error', (err) => reject(new Error(`ssh not found: ${err.message}`)))
    proc.on('exit', (code) => {
      if (sshProcess === null) return // intentional kill
      reject(new Error(stderr.trim() || `SSH exited with code ${code}`))
    })

    // Poll until the local port accepts connections (tunnel is ready)
    let waited = 0
    const poll = () => {
      const sock = net.createConnection({ port: localPort, host: '127.0.0.1' })
      sock.on('connect', () => { sock.destroy(); resolve(localPort) })
      sock.on('error', () => {
        waited += 200
        if (proc.exitCode !== null) return // process already died
        if (waited < 15000) setTimeout(poll, 200)
        else reject(new Error('SSH tunnel timed out'))
      })
    }
    setTimeout(poll, 300)
  }))
}

ipcMain.handle('ssh:connect', async (_event, config: SSHConfig) => {
  try {
    const localPort = await createSSHTunnel(config)
    return { success: true, localPort }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('ssh:disconnect', async () => {
  await destroySSHTunnel()
})

// ──────────────────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 480,
    minHeight: 400,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open DevTools in dev mode only
    // win.webContents.openDevTools()
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Set app name (important for macOS menu)
  app.setName('ClawChat')
  
  createWindow()
  
  // Enable context menu for text inputs, spell check, etc.
  contextMenu({
    showSaveImageAs: true,
    showCopyImageAddress: true,
    showSearchWithGoogle: false,
    showInspectElement: VITE_DEV_SERVER_URL ? true : false,
  })
  
  // Set custom application menu
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'ClawChat',
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    }
  ]
  
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  
  // Register F12 to toggle DevTools
  globalShortcut.register('F12', () => {
    const focused = BrowserWindow.getFocusedWindow()
    if (focused) {
      focused.webContents.toggleDevTools()
    }
  })
  
  // Also support Ctrl+Shift+I (or Cmd+Shift+I on Mac)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const focused = BrowserWindow.getFocusedWindow()
    if (focused) {
      focused.webContents.toggleDevTools()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  destroySSHTunnel()
})
