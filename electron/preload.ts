import { ipcRenderer, contextBridge } from 'electron'

// Secure API bridge — only expose what the renderer needs
contextBridge.exposeInMainWorld('api', {
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile') as Promise<string[]>,
    saveFile: (defaultName: string, content: string) =>
      ipcRenderer.invoke('dialog:saveFile', defaultName, content) as Promise<boolean>,
  },
  file: {
    read: (path: string) => ipcRenderer.invoke('file:read', path) as Promise<{
      name: string
      mimeType: string
      base64: string
      size: number
    }>,
  },
  flashFrame: () => ipcRenderer.send('app:flashFrame'),
})

// Keep legacy ipcRenderer bridge for compatibility
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})
