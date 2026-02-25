import type { ConnectionStatus } from '../types/protocol'
import type { SessionInfo } from '../types/protocol'

interface StatusBarProps {
  status: ConnectionStatus
  activeSession: string
  sessions: SessionInfo[]
  onSelectSession: (key: string) => void
  gatewayUrl: string
  onDisconnect: () => void
}

function extractHost(url: string): string {
  try {
    // URL constructor handles ws:// and wss:// fine
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}

const statusColors: Record<ConnectionStatus, string> = {
  connected: '#22c55e',
  connecting: '#f59e0b',
  handshaking: '#f59e0b',
  disconnected: '#ef4444',
  error: '#ef4444',
}

const statusLabels: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  handshaking: 'Handshaking…',
  disconnected: 'Disconnected',
  error: 'Error',
}

function sessionLabel(s: SessionInfo): string {
  if (s.label) return s.label
  const parts = s.key.split(':')
  if (parts.length >= 3) {
    const name = parts[2] === 'main' ? 'Main' : parts[2]
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} Agent`
  }
  return s.key
}

function formatTokens(n: number): string {
  if (n >= 1000) return `~${Math.round(n / 1000)}k tokens`
  return `${n} tokens`
}

function tokenColor(n: number): string {
  if (n >= 150000) return '#ef4444' // red — critical
  if (n >= 80000) return '#f59e0b'  // amber — getting long
  return '#555'                      // default dim
}

export function StatusBar({ status, activeSession, sessions, onSelectSession, gatewayUrl, onDisconnect }: StatusBarProps) {
  const activeSessionInfo = sessions.find(s => s.key === activeSession)
  const activeModel = activeSessionInfo?.model
  const totalTokens = activeSessionInfo?.totalTokens
  const host = extractHost(gatewayUrl)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.5rem 1rem',
      borderTop: '1px solid #2a2a4a',
      backgroundColor: '#16213e',
      fontSize: '0.75rem',
      color: '#888',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusColors[status],
            display: 'inline-block',
            animation: status === 'connecting' || status === 'handshaking'
              ? 'pulse 1.5s ease-in-out infinite' : undefined,
          }} />
          <span>{statusLabels[status]}</span>
          <span style={{ color: '#555', marginLeft: '0.25rem' }}>({host})</span>
        </div>
        <span style={{ color: '#555' }}>|</span>
        <select
          value={activeSession}
          onChange={(e) => onSelectSession(e.target.value)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#aaa',
            fontSize: '0.75rem',
            cursor: 'pointer',
            outline: 'none',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          {sessions.length === 0 ? (
            <option value={activeSession}>{activeSession}</option>
          ) : (
            sessions.map((s) => (
              <option key={s.key} value={s.key} style={{ backgroundColor: '#16213e', color: '#aaa' }}>
                {sessionLabel(s)}
              </option>
            ))
          )}
        </select>
        {activeModel && (
          <>
            <span style={{ color: '#555' }}>|</span>
            <span style={{ color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeModel}
            </span>
          </>
        )}
        {totalTokens !== undefined && totalTokens > 0 && (
          <>
            <span style={{ color: '#555' }}>|</span>
            <span style={{ color: tokenColor(totalTokens), whiteSpace: 'nowrap' }}>
              {formatTokens(totalTokens)}
            </span>
          </>
        )}
      </div>

      <button
        onClick={onDisconnect}
        style={{
          padding: '0.25rem 0.5rem',
          backgroundColor: 'transparent',
          border: '1px solid #2a2a4a',
          borderRadius: '4px',
          color: '#888',
          fontSize: '0.7rem',
          cursor: 'pointer',
        }}
      >
        Disconnect
      </button>
    </div>
  )
}
