import { useCallback, useEffect, useState } from 'react'
import { ConnectScreen } from './components/ConnectScreen'
import { Dashboard } from './components/Dashboard'
import { useGateway } from './hooks/useGateway'
import type { BackendType } from './lib/gateway-client'
import { logger } from './lib/logger'

function App() {
  const [credentials, setCredentials] = useState<{ url: string; token: string; backend: BackendType; deviceToken?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Load saved credentials on mount — skip auto-connect for SSH mode
  // (the tunnel must be re-established manually each session)
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const connectMode = await window.api.store.get('connectMode') as string
        if (connectMode === 'ssh') {
          // Show the connect screen pre-filled; user connects manually
          setLoading(false)
          return
        }
        const backend = (await window.api.store.get('backend') as BackendType) || 'openclaw'
        let url: string, token: string
        if (backend === 'channel') {
          url = await window.api.store.get('channelUrl') as string
          token = await window.api.store.get('channelToken') as string
        } else {
          url = await window.api.store.get('gatewayUrl') as string
          token = await window.api.store.get('token') as string
        }
        const deviceToken = await window.api.store.get('deviceToken') as string | undefined
        if (url && token) {
          setCredentials({ url, token, backend, deviceToken })
        }
      } catch (err) {
        logger.warn('Failed to load saved credentials:', err)
      } finally {
        setLoading(false)
      }
    }
    loadCredentials()
  }, [])

  const { status, client, disconnect } = useGateway({
    url: credentials?.url || '',
    token: credentials?.token || '',
    backend: credentials?.backend ?? 'openclaw',
    deviceToken: credentials?.deviceToken,
    autoConnect: !!credentials,
  })

  const [isSshMode, setIsSshMode] = useState(false)

  const handleConnect = useCallback(async (url: string, token: string, backend: BackendType = 'openclaw') => {
    const tunnelMode = url.startsWith('ws://127.0.0.1:')
    setIsSshMode(tunnelMode)
    setCredentials({ url, token, backend })
    await window.api.store.set('backend', backend)
    // Don't persist the ephemeral tunnel URL — SSH config is saved by ConnectScreen
    if (!tunnelMode) {
      if (backend === 'openclaw') {
        await window.api.store.set('gatewayUrl', url)
        await window.api.store.set('token', token)
      } else {
        await window.api.store.set('channelUrl', url)
        await window.api.store.set('channelToken', token)
      }
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    disconnect()
    if (isSshMode) await window.api.ssh.disconnect()
    setIsSshMode(false)
    setCredentials(null)
  }, [disconnect, isSshMode])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#1a1a2e',
        color: '#888',
      }}>
        Loading...
      </div>
    )
  }

  if (!credentials) {
    return <ConnectScreen onConnect={handleConnect} status={status} />
  }

  return <Dashboard status={status} client={client} gatewayUrl={credentials.url} isSshTunnel={isSshMode} onDisconnect={handleDisconnect} />
}

export default App
