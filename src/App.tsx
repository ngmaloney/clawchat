import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/tauri-bridge'
import { ConnectScreen } from './components/ConnectScreen'
import { Dashboard } from './components/Dashboard'
import { useGateway } from './hooks/useGateway'

function App() {
  const [credentials, setCredentials] = useState<{ url: string; token: string; deviceToken?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Load saved credentials on mount — skip auto-connect for SSH mode
  // (the tunnel must be re-established manually each session)
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const connectMode = await api.store.get('connectMode') as string
        if (connectMode === 'ssh') {
          // Show the connect screen pre-filled; user connects manually
          setLoading(false)
          return
        }
        const url = await api.store.get('gatewayUrl') as string
        const token = await api.store.get('token') as string
        const deviceToken = await api.store.get('deviceToken') as string | undefined
        if (url && token) {
          setCredentials({ url, token, deviceToken })
        }
      } catch (e) {
        console.error('Failed to load credentials:', e)
      } finally {
        setLoading(false)
      }
    }
    loadCredentials()
  }, [])

  const { status, client, disconnect } = useGateway({
    url: credentials?.url || '',
    token: credentials?.token || '',
    deviceToken: credentials?.deviceToken,
    autoConnect: !!credentials,
  })

  const [isSshMode, setIsSshMode] = useState(false)

  const handleConnect = useCallback(async (url: string, token: string) => {
    const tunnelMode = url.startsWith('ws://127.0.0.1:')
    setIsSshMode(tunnelMode)
    setCredentials({ url, token })
    // Don't persist the ephemeral tunnel URL — SSH config is saved by ConnectScreen
    if (!tunnelMode) {
      await api.store.set('gatewayUrl', url)
      await api.store.set('token', token)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    disconnect()
    if (isSshMode) await api.ssh.disconnect()
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
