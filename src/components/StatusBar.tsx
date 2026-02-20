import type { ConnectionStatus } from '../types/protocol'
import type { ModelInfo } from '../hooks/useGatewayCapabilities'
import type { AppSettings } from '../hooks/useSettings'
import { ModelSwitcher } from './ModelSwitcher'
import { ThinkingToggle } from './ThinkingToggle'

interface StatusBarProps {
  status: ConnectionStatus
  activeSession: string
  model?: string
  models: ModelInfo[]
  thinkingLevel: AppSettings['thinkingLevel']
  onModelSwitch: (modelId: string) => void
  onThinkingChange: (level: AppSettings['thinkingLevel']) => void
  totalTokens?: number
  contextTokens?: number
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

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function contextColor(pct: number): string {
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#888'
}

export function StatusBar({
  status,
  activeSession,
  model,
  models,
  thinkingLevel,
  onModelSwitch,
  onThinkingChange,
  totalTokens,
  contextTokens,
  onDisconnect,
}: StatusBarProps) {
  const hasContext = totalTokens != null && contextTokens != null && contextTokens > 0
  const pct = hasContext ? Math.round((totalTokens! / contextTokens!) * 100) : 0

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
        <span style={{ color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeSession}</span>
        <span style={{ color: '#555' }}>|</span>
        <ModelSwitcher currentModel={model} models={models} onSelect={onModelSwitch} />
        <span style={{ color: '#555' }}>|</span>
        <ThinkingToggle level={thinkingLevel} onChange={onThinkingChange} />
        {hasContext && (
          <>
            <span style={{ color: '#555' }}>|</span>
            <span style={{ color: contextColor(pct), flexShrink: 0 }}>
              {formatTokenCount(totalTokens!)} / {formatTokenCount(contextTokens!)} — {pct}%
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
