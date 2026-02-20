import { Sidebar } from './Sidebar'
import { ChatView } from './ChatView'
import { StatusBar } from './StatusBar'
import type { ConnectionStatus } from '../types/protocol'
import type { GatewayClient } from '../lib/gateway-client'
import { useSessions } from '../hooks/useSessions'
import { useChat } from '../hooks/useChat'

interface DashboardProps {
  status: ConnectionStatus
  client: GatewayClient | null
  onDisconnect: () => void
}

export function Dashboard({ status, client, onDisconnect }: DashboardProps) {
  const {
    sessions,
    activeSessionKey,
    setActiveSessionKey,
    loading: sessionsLoading,
  } = useSessions(client, status)

  const {
    messages,
    send,
    abort,
    isStreaming,
    historyLoading,
  } = useChat(client, status, activeSessionKey)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      backgroundColor: '#1a1a2e',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Main area: sidebar + chat */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        <Sidebar
          sessions={sessions}
          activeSessionKey={activeSessionKey}
          onSelectSession={setActiveSessionKey}
          loading={sessionsLoading}
        />
        <ChatView
          messages={messages}
          isStreaming={isStreaming}
          historyLoading={historyLoading}
          status={status}
          onSend={send}
          onAbort={abort}
        />
      </div>

      {/* Status bar */}
      <StatusBar
        status={status}
        activeSession={activeSessionKey}
        model={sessions.find(s => s.key === activeSessionKey)?.model}
        onDisconnect={onDisconnect}
      />
    </div>
  )
}
