import { useEffect, useState } from 'react'
import type { ConnectionStatus } from '../types/protocol'

interface ConnectScreenProps {
  onConnect: (url: string, token: string) => void
  status: ConnectionStatus
}

export function ConnectScreen({ onConnect, status }: ConnectScreenProps) {
  const [url, setUrl] = useState('ws://localhost:18789')
  const [token, setToken] = useState('')

  // Load saved credentials into the form fields
  useEffect(() => {
    const load = async () => {
      try {
        const savedUrl = await window.api.store.get('gatewayUrl') as string
        const savedToken = await window.api.store.get('token') as string
        if (savedUrl) setUrl(savedUrl)
        if (savedToken) setToken(savedToken)
      } catch {
        // ignore — defaults are fine
      }
    }
    load()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url && token) {
      onConnect(url, token)
    }
  }

  const isConnecting = status === 'connecting'

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
      <div style={{
        textAlign: 'center',
        marginBottom: '2rem',
      }}>
        <img src="/MyGideon.png" alt="Gideon" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          margin: '0.5rem 0',
          color: '#fff',
        }}>
          Gideon
        </h1>
        <p style={{ color: '#888', fontSize: '0.875rem' }}>
          Connect to your OpenClaw Gateway
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '320px',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
            Gateway URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://localhost:18789"
            disabled={isConnecting}
            style={{
              width: '100%',
              padding: '0.625rem',
              backgroundColor: '#16213e',
              border: '1px solid #2a2a4a',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
            Auth Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your Gateway token"
            disabled={isConnecting}
            style={{
              width: '100%',
              padding: '0.625rem',
              backgroundColor: '#16213e',
              border: '1px solid #2a2a4a',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isConnecting || !url || !token}
          style={{
            padding: '0.75rem',
            backgroundColor: isConnecting ? '#333' : '#f59e0b',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>

        {status === 'error' && (
          <p style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'center' }}>
            Connection failed. Check your URL and token.
          </p>
        )}
      </form>
    </div>
  )
}
