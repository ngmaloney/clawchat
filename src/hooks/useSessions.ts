import { useCallback, useEffect, useState } from 'react'
import type { GatewayClient } from '../lib/gateway-client'
import type { SessionInfo, SessionsListResponse, ConnectionStatus } from '../types/protocol'

const DEFAULT_SESSION_KEY = 'agent:main:main'

export interface SessionsHandle {
  sessions: SessionInfo[]
  activeSessionKey: string
  setActiveSessionKey: (key: string) => void
  refreshSessions: () => Promise<void>
  loading: boolean
}

export function useSessions(client: GatewayClient | null, status: ConnectionStatus): SessionsHandle {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [activeSessionKey, setActiveSessionKey] = useState(DEFAULT_SESSION_KEY)
  const [loading, setLoading] = useState(false)

  const refreshSessions = useCallback(async () => {
    if (!client || status !== 'connected') return
    setLoading(true)
    try {
      const res = await client.call('sessions.list', {}) as unknown as SessionsListResponse
      // Filter to only show active sessions:
      // - Main session always shown
      // - Sessions with actual conversation (totalTokens > 0)
      const activeSessions = (res.sessions ?? []).filter(s => 
        s.key === DEFAULT_SESSION_KEY || (s.totalTokens ?? 0) > 0
      )
      setSessions(activeSessions)
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }, [client, status])

  // Fetch sessions on connect
  useEffect(() => {
    if (status === 'connected') {
      void refreshSessions()
    } else if (status === 'disconnected') {
      setSessions([])
    }
  }, [status, refreshSessions])

  // Subscribe to chat events to auto-refresh session list when new activity occurs
  useEffect(() => {
    if (!client || status !== 'connected') return

    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const unsub = client.on('chat', () => {
      // Debounce refresh to avoid excessive API calls during streaming
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        void refreshSessions()
      }, 1000) // Wait 1s after last chat event before refreshing
    })

    return () => {
      unsub()
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [client, status, refreshSessions])

  return {
    sessions,
    activeSessionKey,
    setActiveSessionKey,
    refreshSessions,
    loading,
  }
}
