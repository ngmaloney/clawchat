import { useEffect, useState } from 'react'
import { api } from '../lib/tauri-bridge'
import type { ConnectionStatus } from '../types/protocol'

interface ConnectScreenProps {
  onConnect: (url: string, token: string) => void
  status: ConnectionStatus
}

type ConnectMode = 'direct' | 'ssh'

const inputStyle = {
  width: '100%',
  padding: '0.625rem',
  backgroundColor: '#16213e',
  border: '1px solid #2a2a4a',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#888',
  marginBottom: '0.25rem',
}

export function ConnectScreen({ onConnect, status }: ConnectScreenProps) {
  const [mode, setMode] = useState<ConnectMode>('direct')

  // Direct mode
  const [url, setUrl] = useState('ws://localhost:18789')
  const [token, setToken] = useState('')

  // SSH mode
  const [sshHost, setSshHost] = useState('')
  const [sshPort, setSshPort] = useState('22')
  const [sshUser, setSshUser] = useState('')
  const [sshKeyPath, setSshKeyPath] = useState('~/.ssh/id_rsa')
  const [sshRemotePort, setSshRemotePort] = useState('18789')

  const [sshError, setSshError] = useState('')
  const [isTunneling, setIsTunneling] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const savedUrl = await api.store.get('gatewayUrl') as string
        const savedToken = await api.store.get('token') as string
        const savedMode = await api.store.get('connectMode') as ConnectMode
        const savedSshHost = await api.store.get('sshHost') as string
        const savedSshPort = await api.store.get('sshPort') as string
        const savedSshUser = await api.store.get('sshUser') as string
        const savedSshKeyPath = await api.store.get('sshKeyPath') as string
        const savedSshRemotePort = await api.store.get('sshRemotePort') as string

        if (savedUrl) setUrl(savedUrl)
        if (savedToken) setToken(savedToken)
        if (savedMode) setMode(savedMode)
        if (savedSshHost) setSshHost(savedSshHost)
        if (savedSshPort) setSshPort(savedSshPort)
        if (savedSshUser) setSshUser(savedSshUser)
        if (savedSshKeyPath) setSshKeyPath(savedSshKeyPath)
        if (savedSshRemotePort) setSshRemotePort(savedSshRemotePort)
      } catch {
        // ignore — defaults are fine
      }
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSshError('')

    if (mode === 'direct') {
      if (url && token) {
        await api.store.set('connectMode', 'direct')
        await api.store.set('gatewayUrl', url)
        await api.store.set('token', token)
        onConnect(url, token)
      }
      return
    }

    // SSH tunnel mode
    setIsTunneling(true)
    try {
      // Persist SSH config
      await api.store.set('connectMode', 'ssh')
      await api.store.set('token', token)
      await api.store.set('sshHost', sshHost)
      await api.store.set('sshPort', sshPort)
      await api.store.set('sshUser', sshUser)
      await api.store.set('sshKeyPath', sshKeyPath)
      await api.store.set('sshRemotePort', sshRemotePort)

      const result = await api.ssh.connect({
        host: sshHost,
        port: parseInt(sshPort) || 22,
        username: sshUser,
        privateKeyPath: sshKeyPath,
        remotePort: parseInt(sshRemotePort) || 18789,
      })

      if (!result.success || !result.localPort) {
        setSshError(result.error || 'SSH tunnel failed')
        return
      }

      // Connect via the local tunnel port
      onConnect(`ws://127.0.0.1:${result.localPort}`, token)
    } catch (err) {
      setSshError((err as Error).message || 'SSH tunnel failed')
    } finally {
      setIsTunneling(false)
    }
  }

  const isConnecting = status === 'connecting' || isTunneling
  const submitLabel = isTunneling ? 'Opening tunnel...' : isConnecting ? 'Connecting...' : 'Connect'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      backgroundColor: '#1a1a2e',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span style={{ fontSize: '4rem' }}>🦀</span>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0.5rem 0', color: '#fff' }}>
          ClawChat
        </h1>
        <p style={{ color: '#888', fontSize: '0.875rem' }}>
          Connect to your OpenClaw Gateway
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{
        display: 'flex',
        backgroundColor: '#16213e',
        borderRadius: '8px',
        padding: '3px',
        marginBottom: '1.25rem',
        border: '1px solid #2a2a4a',
      }}>
        {(['direct', 'ssh'] as ConnectMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setSshError('') }}
            style={{
              padding: '0.375rem 1rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: mode === m ? '#e85d04' : 'transparent',
              color: mode === m ? '#fff' : '#888',
              transition: 'all 0.15s',
            }}
          >
            {m === 'direct' ? 'Direct' : 'SSH Tunnel'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px' }}>

        {mode === 'direct' ? (
          <>
            <div>
              <label style={labelStyle}>Gateway URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ws://localhost:18789"
                disabled={isConnecting}
                style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              />
            </div>
            <div>
              <label style={labelStyle}>Auth Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your Gateway token"
                disabled={isConnecting}
                style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
              <div>
                <label style={labelStyle}>SSH Host</label>
                <input
                  type="text"
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                  placeholder="user@myserver.com"
                  disabled={isConnecting}
                  style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
                />
              </div>
              <div style={{ width: '70px' }}>
                <label style={labelStyle}>Port</label>
                <input
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                  disabled={isConnecting}
                  style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>SSH Username</label>
              <input
                type="text"
                value={sshUser}
                onChange={(e) => setSshUser(e.target.value)}
                placeholder="ubuntu"
                disabled={isConnecting}
                style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              />
            </div>

            <div>
              <label style={labelStyle}>SSH Key Path</label>
              <input
                type="text"
                value={sshKeyPath}
                onChange={(e) => setSshKeyPath(e.target.value)}
                placeholder="~/.ssh/id_rsa"
                disabled={isConnecting}
                style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Auth Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Gateway token"
                  disabled={isConnecting}
                  style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
                />
              </div>
              <div style={{ width: '80px' }}>
                <label style={labelStyle}>Gateway Port</label>
                <input
                  type="number"
                  value={sshRemotePort}
                  onChange={(e) => setSshRemotePort(e.target.value)}
                  disabled={isConnecting}
                  style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isConnecting || !token || (mode === 'direct' ? !url : !sshHost || !sshUser)}
          style={{
            padding: '0.75rem',
            backgroundColor: isConnecting ? '#333' : '#e85d04',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {submitLabel}
        </button>

        {(status === 'error' && !sshError) && (
          <p style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'center' }}>
            Connection failed. Check your URL and token.
          </p>
        )}

        {sshError && (
          <p style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'center' }}>
            SSH error: {sshError}
          </p>
        )}

        {mode === 'ssh' && (
          <p style={{ color: '#555', fontSize: '0.7rem', textAlign: 'center', margin: 0 }}>
            Connects via SSH key auth. Password auth not supported.
          </p>
        )}
      </form>
    </div>
  )
}
