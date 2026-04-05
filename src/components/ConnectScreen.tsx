import { useEffect, useState } from 'react'
import type { ConnectionStatus } from '../types/protocol'
import type { BackendType } from '../lib/gateway-client'

interface ConnectScreenProps {
  onConnect: (url: string, token: string, backend: BackendType) => void
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
  const [backend, setBackend] = useState<BackendType>('openclaw')
  const [mode, setMode] = useState<ConnectMode>('direct')

  // OpenClaw state
  const [ocUrl, setOcUrl] = useState('ws://localhost:18789')
  const [ocToken, setOcToken] = useState('')

  // Channel state
  const [chUrl, setChUrl] = useState('ws://tc1.home.wrox.us:9700')
  const [chToken, setChToken] = useState('')

  // SSH mode (OpenClaw only)
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
        const savedBackend = await window.api.store.get('backend') as BackendType
        const savedMode = await window.api.store.get('connectMode') as ConnectMode
        const savedOcUrl = await window.api.store.get('gatewayUrl') as string
        const savedOcToken = await window.api.store.get('token') as string
        const savedChUrl = await window.api.store.get('channelUrl') as string
        const savedChToken = await window.api.store.get('channelToken') as string
        const savedSshHost = await window.api.store.get('sshHost') as string
        const savedSshPort = await window.api.store.get('sshPort') as string
        const savedSshUser = await window.api.store.get('sshUser') as string
        const savedSshKeyPath = await window.api.store.get('sshKeyPath') as string
        const savedSshRemotePort = await window.api.store.get('sshRemotePort') as string

        if (savedBackend) setBackend(savedBackend)
        if (savedMode) setMode(savedMode)
        if (savedOcUrl) setOcUrl(savedOcUrl)
        if (savedOcToken) setOcToken(savedOcToken)
        if (savedChUrl) setChUrl(savedChUrl)
        if (savedChToken) setChToken(savedChToken)
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

  // Active URL/token based on backend
  const url = backend === 'openclaw' ? ocUrl : chUrl
  const token = backend === 'openclaw' ? ocToken : chToken
  const setUrl = backend === 'openclaw' ? setOcUrl : setChUrl
  const setToken = backend === 'openclaw' ? setOcToken : setChToken

  const showSsh = backend === 'openclaw' && mode === 'ssh'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSshError('')

    if (!showSsh) {
      if (url && (token || backend === 'channel')) onConnect(url, token, backend)
      return
    }

    // SSH tunnel mode (OpenClaw only)
    setIsTunneling(true)
    try {
      await window.api.store.set('connectMode', 'ssh')
      await window.api.store.set('sshHost', sshHost)
      await window.api.store.set('sshPort', sshPort)
      await window.api.store.set('sshUser', sshUser)
      await window.api.store.set('sshKeyPath', sshKeyPath)
      await window.api.store.set('sshRemotePort', sshRemotePort)

      const result = await window.api.ssh.connect({
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

      onConnect(`ws://127.0.0.1:${result.localPort}`, token, backend)
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
      </div>

      {/* Backend tabs */}
      <div style={{
        display: 'flex',
        width: '320px',
        marginBottom: '1.25rem',
        borderBottom: '2px solid #2a2a4a',
      }}>
        {([['openclaw', 'OpenClaw'], ['channel', 'Claude Channels']] as const).map(([b, label]) => (
          <button
            key={b}
            type="button"
            onClick={() => { setBackend(b as BackendType); setSshError('') }}
            style={{
              flex: 1,
              padding: '0.625rem 0',
              border: 'none',
              borderBottom: backend === b ? '2px solid #e85d04' : '2px solid transparent',
              marginBottom: '-2px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: backend === b ? '#fff' : '#666',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Connection mode toggle — OpenClaw only */}
      {backend === 'openclaw' && (
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
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px' }}>

        {!showSsh ? (
          <>
            <div>
              <label style={labelStyle}>{backend === 'openclaw' ? 'Gateway URL' : 'Channel URL'}</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={backend === 'openclaw' ? 'ws://localhost:18789' : 'ws://host:9700'}
                disabled={isConnecting}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Auth Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={backend === 'openclaw' ? 'Enter your Gateway token' : 'Enter your Channel token'}
                disabled={isConnecting}
                style={inputStyle}
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
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isConnecting || (backend === 'openclaw' && !token) || (!showSsh ? !url : !sshHost || !sshUser)}
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

        {showSsh && (
          <p style={{ color: '#555', fontSize: '0.7rem', textAlign: 'center', margin: 0 }}>
            Connects via SSH key auth. Password auth not supported.
          </p>
        )}
      </form>
    </div>
  )
}
