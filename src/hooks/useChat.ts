import { useCallback, useEffect, useRef, useState } from 'react'
import type { GatewayClient } from '../lib/gateway-client'
import { logger } from '../lib/logger'
import type {
  ChatMessage,
  ChatHistoryResponse,
  ChatSendAck,
  ChatAbortResponse,
  ChatEventPayload,
  ConnectionStatus,
  ChatAttachment,
} from '../types/protocol'

export interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp?: string | number
  streaming?: boolean
  error?: string
  attachments?: ChatAttachment[]
}

export interface ChatHandle {
  messages: DisplayMessage[]
  send: (text: string, attachments?: ChatAttachment[]) => Promise<void>
  abort: () => Promise<void>
  loadHistory: (sessionKey: string) => Promise<void>
  isStreaming: boolean
  historyLoading: boolean
}

let _msgId = 0
function newMsgId(): string {
  return `msg-${++_msgId}-${Date.now()}`
}

// Max time to wait after last delta before declaring stream stalled
const STREAM_STALL_MS = 90_000

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const MAX_ATTACHMENT_SIZE = 500 * 1024 // 500KB

function stripLargeDataUris(text: string): string {
  // Remove data URI images larger than 500KB to prevent browser errors
  const dataUriPattern = /!\[([^\]]*)\]\(data:(image\/[^;]+);base64,([^)]+)\)/g
  
  return text.replace(dataUriPattern, (match, alt, _mimeType, base64Data) => {
    const cleanedBase64 = base64Data.replace(/\s/g, '')
    const estimatedSize = (cleanedBase64.length * 3) / 4
    
    if (estimatedSize > MAX_ATTACHMENT_SIZE) {
      const sizeKB = Math.round(estimatedSize / 1024)
      return `[Image too large: ${alt || 'image.png'} (~${sizeKB}KB)]`
    }
    
    // Keep small data URIs as-is
    return match
  })
}

function filterLargeAttachments(attachments?: ChatAttachment[]): ChatAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined
  
  const filtered = attachments.filter(att => {
    if (!att.content) return true
    const size = (att.content.length * 3) / 4
    if (size > MAX_ATTACHMENT_SIZE) {
      return false
    }
    return true
  })
  
  return filtered.length > 0 ? filtered : undefined
}

function extractText(msg: ChatMessage): string {
  if (!msg || !msg.content) return ''
  // Handle content as plain string (common for user messages in history)
  if (typeof msg.content === 'string') return stripLargeDataUris(msg.content)
  // Handle content as array of blocks
  if (!Array.isArray(msg.content) || msg.content.length === 0) return ''
  const text = msg.content
    .filter((b) => b && b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('')
  return stripLargeDataUris(text)
}

export function useChat(
  client: GatewayClient | null,
  status: ConnectionStatus,
  activeSessionKey: string,
): ChatHandle {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const activeRunIdRef = useRef<string | null>(null)
  const sessionKeyRef = useRef(activeSessionKey)
  // Cache messages per session to avoid losing local state on session switch
  const messagesCacheRef = useRef<Map<string, DisplayMessage[]>>(new Map())
  // Ref to loadHistory so event handlers always call the latest version
  const loadHistoryRef = useRef<((sessionKey: string) => Promise<void>) | null>(null)
  // Set to true synchronously when user initiates a send, before any async work.
  // Cleared on final/error. Lets the final handler distinguish "we sent this"
  // from "another client sent this" without relying on React state or async acks.
  const pendingLocalSendRef = useRef(false)
  // Timestamp of last delta received — used to detect stalled streams
  const lastDeltaTimeRef = useRef<number | null>(null)
  // Timeout handle for stream staleness check
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep ref in sync
  sessionKeyRef.current = activeSessionKey

  // Clear stalled streaming state — marks stuck bubble as errored and resets streaming
  const clearStalledStream = useCallback(() => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }
    lastDeltaTimeRef.current = null
    activeRunIdRef.current = null
    pendingLocalSendRef.current = false
    setIsStreaming(false)
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.streaming)
      if (idx < 0) return prev
      const updated = [...prev]
      updated[idx] = { ...updated[idx], streaming: false, error: 'Response interrupted — connection lost or timed out.' }
      return updated
    })
  }, [])

  // Reset stall timer whenever a delta arrives
  const resetStallTimer = useCallback(() => {
    lastDeltaTimeRef.current = Date.now()
    if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current)
    streamTimeoutRef.current = setTimeout(() => {
      logger.warn('Stream stall detected — no delta for', STREAM_STALL_MS, 'ms')
      clearStalledStream()
    }, STREAM_STALL_MS)
  }, [clearStalledStream])

  // When connection drops while streaming, clear the stuck state immediately
  useEffect(() => {
    if (status !== 'connected' && isStreaming) {
      logger.warn('Connection lost while streaming — clearing stuck streaming state')
      clearStalledStream()
    }
  }, [status, isStreaming, clearStalledStream])

  // Cache current messages when they change
  useEffect(() => {
    if (activeSessionKey && messages.length > 0) {
      messagesCacheRef.current.set(activeSessionKey, messages)
    }
  }, [activeSessionKey, messages])

  // Subscribe to chat events
  useEffect(() => {
    if (!client) return

    const unsub = client.on('chat', (payload) => {
      const ev = payload as unknown as ChatEventPayload
      // Only process events for the active session
      if (ev.sessionKey !== sessionKeyRef.current) return

      if (ev.state === 'delta') {
        resetStallTimer()
        const text = extractText(ev.message)
        const attachments = filterLargeAttachments(ev.message?.attachments)
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.streaming && m.role === 'assistant')
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], text, attachments, streaming: true }
            return updated
          }
          // First delta — create streaming message
          return [...prev, {
            id: newMsgId(),
            role: 'assistant' as const,
            text,
            attachments,
            streaming: true,
          }]
        })
      } else if (ev.state === 'final') {
        if (streamTimeoutRef.current) {
          clearTimeout(streamTimeoutRef.current)
          streamTimeoutRef.current = null
        }
        lastDeltaTimeRef.current = null
        const text = extractText(ev.message)
        const attachments = filterLargeAttachments(ev.message?.attachments)
        // pendingLocalSendRef is set synchronously in send() before any async work,
        // so it's always accurate regardless of React batching or ack timing.
        const wasLocalRun = pendingLocalSendRef.current
        pendingLocalSendRef.current = false
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.streaming && m.role === 'assistant')
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              text,
              attachments,
              streaming: false,
              timestamp: ev.message?.timestamp,
            }
            return updated
          }
          return [...prev, {
            id: newMsgId(),
            role: 'assistant' as const,
            text,
            attachments,
            timestamp: ev.message?.timestamp,
            streaming: false,
          }]
        })
        activeRunIdRef.current = null
        setIsStreaming(false)
        if (!wasLocalRun) {
          void loadHistoryRef.current?.(sessionKeyRef.current)
        }
      } else if (ev.state === 'error') {
        if (streamTimeoutRef.current) {
          clearTimeout(streamTimeoutRef.current)
          streamTimeoutRef.current = null
        }
        lastDeltaTimeRef.current = null
        pendingLocalSendRef.current = false
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.streaming && m.role === 'assistant')
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              streaming: false,
              error: ev.errorMessage,
            }
            return updated
          }
          return [...prev, {
            id: newMsgId(),
            role: 'assistant' as const,
            text: '',
            streaming: false,
            error: ev.errorMessage,
          }]
        })
        activeRunIdRef.current = null
        setIsStreaming(false)
      }
    })

    return () => {
      unsub()
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current)
        streamTimeoutRef.current = null
      }
    }
  }, [client, resetStallTimer])

  // Load history when session changes
  const loadHistory = useCallback(async (sessionKey: string) => {
    if (!client || status !== 'connected') return
    
    // Restore from cache immediately if available (for instant UI feedback)
    const cached = messagesCacheRef.current.get(sessionKey)
    if (cached) {
      setMessages(cached)
    }
    
    setHistoryLoading(true)
    try {
      const res = await client.call('chat.history', {
        sessionKey,
        limit: 200,
      }) as unknown as ChatHistoryResponse

      const history: DisplayMessage[] = (res.messages ?? [])
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && extractText(m).trim())
        .map((m) => ({
          id: newMsgId(),
          role: m.role as 'user' | 'assistant',
          text: extractText(m),
          timestamp: m.timestamp,
          attachments: filterLargeAttachments(m.attachments),
          streaming: false,
        }))
      
      // Update messages with fresh history from gateway
      setMessages(history)
      // Update cache with fresh data
      messagesCacheRef.current.set(sessionKey, history)
    } catch (err) {
      logger.error('Failed to load chat history for session:', sessionKey, err)
      // Don't clear messages on error - keep the cached version if we have it
      if (!cached) {
        setMessages([])
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [client, status])

  // Keep ref to loadHistory current so event handlers (which close over initial value) can call it
  loadHistoryRef.current = loadHistory

  // Track the last session we loaded history for
  const lastLoadedSessionRef = useRef<string | null>(null)
  
  // Reload history when active session changes or on initial connect.
  // Uses loadHistoryRef (not loadHistory directly) so that transient function
  // reference changes — caused by status/client cycling during reconnects —
  // do NOT re-trigger this effect and spuriously reload history.
  useEffect(() => {
    if (status === 'connected' && activeSessionKey) {
      const isDifferentSession = lastLoadedSessionRef.current !== activeSessionKey
      const hasNoCache = !messagesCacheRef.current.has(activeSessionKey)

      if (isDifferentSession || hasNoCache) {
        // Only reset streaming state on an actual session change, not every render
        activeRunIdRef.current = null
        pendingLocalSendRef.current = false
        setIsStreaming(false)
        void loadHistoryRef.current?.(activeSessionKey)
        lastLoadedSessionRef.current = activeSessionKey
      }
    } else if (!activeSessionKey) {
      setMessages([])
      lastLoadedSessionRef.current = null
      activeRunIdRef.current = null
      pendingLocalSendRef.current = false
      setIsStreaming(false)
    }
    // If disconnected but session key exists, keep existing messages
    // (don't clear on temporary disconnections)
  }, [activeSessionKey, status])

  const send = useCallback(async (text: string, attachments?: ChatAttachment[]) => {
    if (!client || status !== 'connected' || !text.trim()) return

    // Append user message immediately
    const userMsg: DisplayMessage = {
      id: newMsgId(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
      attachments,
    }
    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)
    pendingLocalSendRef.current = true

    try {
      const params: {
        sessionKey: string
        message: string
        idempotencyKey: string
        attachments?: ChatAttachment[]
      } = {
        sessionKey: sessionKeyRef.current,
        message: text.trim(),
        idempotencyKey: uuid(),
      }
      
      if (attachments && attachments.length > 0) {
        params.attachments = attachments
      }

      const ack = await client.call('chat.send', params) as unknown as ChatSendAck

      activeRunIdRef.current = ack.runId ?? null
    } catch (err) {
      logger.error('Failed to send message:', err)
      let errorMsg = err instanceof Error ? err.message : 'Failed to send message'
      
      // Detect WebSocket 1009 "Message Too Large" error
      if (errorMsg.includes('1009') || errorMsg.toLowerCase().includes('too large')) {
        const maxPayloadBytes = client?.getMaxPayload() || 1048576
        const maxPayloadMB = (maxPayloadBytes / (1024 * 1024)).toFixed(1)
        errorMsg = `**📎 File too large to send**\n\nThis attachment exceeds the ${maxPayloadMB}MB gateway limit.\n\n**Quick fix:** Try compressing or resizing the image first.\n\n**Advanced:** You can increase the gateway limit by editing \`~/.openclaw/openclaw.json\` - see docs.openclaw.ai for details.`
      }
      
      pendingLocalSendRef.current = false
      setMessages((prev) => [...prev, {
        id: newMsgId(),
        role: 'assistant',
        text: '',
        streaming: false,
        error: errorMsg,
      }])
      setIsStreaming(false)
    }
  }, [client, status])

  const abort = useCallback(async () => {
    if (!client || status !== 'connected') return
    try {
      await client.call('chat.abort', {
        sessionKey: sessionKeyRef.current,
      }) as unknown as ChatAbortResponse
    } catch (err) {
      logger.warn('chat.abort failed:', err)
    }
    // Streaming end will be handled by the final/error event
  }, [client, status])

  return {
    messages,
    send,
    abort,
    loadHistory,
    isStreaming,
    historyLoading,
  }
}
