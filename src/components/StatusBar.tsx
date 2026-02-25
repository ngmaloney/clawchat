import type { ConnectionStatus } from '../types/protocol'
import type { SessionInfo } from '../types/protocol'

interface StatusBarProps {
  status: ConnectionStatus
  activeSession: string
  sessions: SessionInfo[]
  onSelectSession: (key: string) => void
  onDisconnect: () => void
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

export function StatusBar({ status, activeSession, sessions, onSelectSession, onDisconnect }: StatusBarProps) {
  const activeModel = sessions.find(s => s.key === activeSession)?.model

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
