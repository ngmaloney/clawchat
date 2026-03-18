import { useEffect, useState } from 'react'
import { ChatView } from './ChatView'
import { StatusBar } from './StatusBar'
import type { ConnectionStatus } from '../types/protocol'
import type { GatewayClient } from '../lib/gateway-client'
import { useSessions } from '../hooks/useSessions'
import { useChat } from '../hooks/useChat'
import { logger } from '../lib/logger'

interface AgentIdentity {
  name: string
  avatar: string
  emoji?: string
  agentId: string
}

interface DashboardProps {
  status: ConnectionStatus
  client: GatewayClient | null
  gatewayUrl: string
  isSshTunnel?: boolean
  onDisconnect: () => void
}

export function Dashboard({ status, client, gatewayUrl, isSshTunnel, onDisconnect }: DashboardProps) {
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(null)

  const {
    sessions,
    activeSessionKey,
    setActiveSessionKey,
  } = useSessions(client, status)

  const {
    messages,
    send,
    abort,
    isStreaming,
    historyLoading,
  } = useChat(client, status, activeSessionKey)

  // Fetch agent identity on connect
  useEffect(() => {
    if (status !== 'connected' || !client) {
      setAgentIdentity(null)
      return
    }
    client.call('agent.identity.get', {}).then((res) => {
      const identity = res as unknown as AgentIdentity
      if (identity?.name) {
        setAgentIdentity(identity)
        logger.info('Agent identity:', identity.name, identity.avatar ? '(has avatar)' : '(no avatar)')
      }
    }).catch((err) => {
      logger.warn('Failed to fetch agent identity:', err)
    })
  }, [status, client])

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
      {/* Main area: chat only */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        <ChatView
          messages={messages}
          isStreaming={isStreaming}
          historyLoading={historyLoading}
          status={status}
          onSend={send}
          onAbort={abort}
          botAvatar={agentIdentity?.avatar}
          botName={agentIdentity?.name}
        />
      </div>

      {/* Status bar */}
      <StatusBar
        status={status}
        activeSession={activeSessionKey}
        sessions={sessions}
        onSelectSession={setActiveSessionKey}
        gatewayUrl={gatewayUrl}
        isSshTunnel={isSshTunnel}
        onDisconnect={onDisconnect}
      />
    </div>
  )
}
