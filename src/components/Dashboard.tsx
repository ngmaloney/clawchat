import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { ChatView } from './ChatView'
import { StatusBar } from './StatusBar'
import { StreamPanel } from './StreamPanel'
import { SettingsScreen } from './SettingsScreen'
import type { ConnectionStatus } from '../types/protocol'
import type { GatewayClient } from '../lib/gateway-client'
import { useSessions } from '../hooks/useSessions'
import { useChat } from '../hooks/useChat'
import { useStreamLog } from '../hooks/useStreamLog'
import { useGatewayCapabilities } from '../hooks/useGatewayCapabilities'
import { useSettings } from '../hooks/useSettings'
interface DashboardProps {
  status: ConnectionStatus
  client: GatewayClient | null
  onDisconnect: () => void
}

export function Dashboard({ status, client, onDisconnect }: DashboardProps) {
  const [showStream, setShowStream] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({})

  const { settings, updateSetting } = useSettings()
  const { models, agents } = useGatewayCapabilities(client, status)

  const {
    sessions,
    activeSessionKey,
    setActiveSessionKey,
    refreshSessions,
    loading: sessionsLoading,
  } = useSessions(client, status)

  const {
    messages,
    send,
    abort,
    isStreaming,
    historyLoading,
    approvalRequests,
    respondToApproval,
  } = useChat(client, status, activeSessionKey, settings, modelOverrides[activeSessionKey])

  const { entries, clear } = useStreamLog(client, status)

  // --- Model switch for current session ---
  const handleModelSwitch = useCallback(async (modelId: string) => {
    if (!activeSessionKey) return
    // Store locally so StatusBar reflects the change immediately
    setModelOverrides((prev) => ({ ...prev, [activeSessionKey]: modelId }))
    // Also try to persist on gateway
    if (client && status === 'connected') {
      try {
        await client.call('sessions.patch', { sessionKey: activeSessionKey, model: modelId })
        await refreshSessions()
      } catch {
        // Gateway may not support sessions.patch — local override still works
      }
    }
  }, [client, status, activeSessionKey, refreshSessions])

  // --- Session create ---
  const handleNewSession = useCallback(async () => {
    if (!client || status !== 'connected') return
    try {
      // Try gateway-side creation first
      const res = await client.call('sessions.create', {}) as { sessionKey?: string }
      await refreshSessions()
      if (res.sessionKey) {
        setActiveSessionKey(res.sessionKey)
        return
      }
    } catch {
      // Gateway may not support sessions.create — create client-side key
      // Session will be auto-created when user sends first message
    }
    const slug = Math.random().toString(36).slice(2, 8)
    const newKey = `agent:main:session-${slug}`
    setActiveSessionKey(newKey)
  }, [client, status, refreshSessions, setActiveSessionKey])

  // --- Session rename ---
  const handleRenameSession = useCallback(async (sessionKey: string, label: string) => {
    if (!client || status !== 'connected') return
    try {
      await client.call('sessions.patch', { sessionKey, label })
      await refreshSessions()
    } catch (err) {
      console.error('[Dashboard] Failed to rename session:', err)
    }
  }, [client, status, refreshSessions])

  // --- Session delete/reset ---
  const handleDeleteSession = useCallback(async (sessionKey: string) => {
    if (!client || status !== 'connected') return
    try {
      await client.call('sessions.reset', { sessionKey })
      await refreshSessions()
    } catch (err) {
      console.error('[Dashboard] Failed to reset session:', err)
    }
  }, [client, status, refreshSessions])

  // --- Export conversation ---
  const handleExportConversation = useCallback(async () => {
    if (messages.length === 0) return
    const md = messages.map((m) => {
      const role = m.role === 'user' ? 'User' : 'Assistant'
      return `## ${role}\n\n${m.text}\n`
    }).join('\n---\n\n')
    try {
      await window.api.dialog.saveFile(
        `gideon-export-${Date.now()}.md`,
        md,
      )
    } catch (err) {
      console.error('[Dashboard] Failed to export:', err)
    }
  }, [messages])

  // --- Session navigation ---
  const navigateSession = useCallback((delta: number) => {
    if (sessions.length <= 1) return
    const idx = sessions.findIndex((s) => s.key === activeSessionKey)
    const next = idx + delta
    if (next >= 0 && next < sessions.length) {
      setActiveSessionKey(sessions[next].key)
    }
  }, [sessions, activeSessionKey, setActiveSessionKey])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (e.key === 'Escape') {
        if (showSettings) setShowSettings(false)
        else if (showStream) setShowStream(false)
        return
      }
      if (mod && e.key === 'n') {
        e.preventDefault()
        void handleNewSession()
        return
      }
      if (mod && e.key === '[') {
        e.preventDefault()
        navigateSession(-1)
        return
      }
      if (mod && e.key === ']') {
        e.preventDefault()
        navigateSession(1)
        return
      }
      if (mod && e.key === 'e') {
        e.preventDefault()
        void handleExportConversation()
        return
      }
      if (mod && e.key === ',') {
        e.preventDefault()
        setShowSettings((v) => !v)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSettings, showStream, handleNewSession, navigateSession, handleExportConversation])

  const activeSession = sessions.find((s) => s.key === activeSessionKey)

  // Derive assistant display name from session
  const assistantName = (() => {
    if (activeSession?.label) return activeSession.label
    const parts = activeSessionKey.split(':')
    if (parts.length >= 3) {
      if (parts[2] === 'main') return 'Gideon'
      const name = parts[2]
      return `${name.charAt(0).toUpperCase()}${name.slice(1)} Agent`
    }
    return 'Assistant'
  })()

  // Set window title to assistant name
  useEffect(() => {
    document.title = assistantName
  }, [assistantName])

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
      {/* Main area: sidebar + chat + optional stream panel */}
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
          onNewSession={handleNewSession}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
          onOpenSettings={() => setShowSettings(true)}
          loading={sessionsLoading}
        />
        <ChatView
          messages={messages}
          isStreaming={isStreaming}
          historyLoading={historyLoading}
          status={status}
          onSend={send}
          onAbort={abort}
          showStreamToggle
          streamOpen={showStream}
          onToggleStream={() => setShowStream((v) => !v)}
          streamCount={entries.filter((e) => {
            if (e.event === 'exec') return true
            if (e.event === 'chat') {
              if (e.state === 'final' || e.state === 'error' || e.role === 'user') return true
              if (e.contentTypes?.some(t => t === 'tool_use' || t === 'tool_result')) return true
            }
            return false
          }).length}
          approvalRequests={approvalRequests}
          onRespondApproval={respondToApproval}
          assistantName={assistantName}
        />
        {showStream && (
          <StreamPanel
            entries={entries}
            onClear={clear}
            onClose={() => setShowStream(false)}
          />
        )}
      </div>

      {/* Status bar */}
      <StatusBar
        status={status}
        activeSession={activeSessionKey}
        model={modelOverrides[activeSessionKey] ?? activeSession?.model}
        models={models}
        thinkingLevel={settings.thinkingLevel}
        onModelSwitch={handleModelSwitch}
        onThinkingChange={(level) => updateSetting('thinkingLevel', level)}
        totalTokens={activeSession?.totalTokens}
        contextTokens={activeSession?.contextTokens}
        onDisconnect={onDisconnect}
      />

      {/* Settings overlay */}
      {showSettings && (
        <SettingsScreen
          settings={settings}
          onUpdateSetting={updateSetting}
          models={models}
          agents={agents}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
