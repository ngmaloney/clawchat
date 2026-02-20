import { useCallback, useEffect, useRef, useState } from 'react'
import type { GatewayClient } from '../lib/gateway-client'
import type {
  ChatMessage,
  ChatHistoryResponse,
  ChatSendAck,
  ChatAbortResponse,
  ChatEventPayload,
  ConnectionStatus,
  ChatAttachment,
} from '../types/protocol'
import type { AppSettings } from './useSettings'
import type { ToolApprovalRequest } from '../components/ToolApprovalCard'

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
  approvalRequests: ToolApprovalRequest[]
  respondToApproval: (requestId: string, approved: boolean) => void
}

let _msgId = 0
function newMsgId(): string {
  return `msg-${++_msgId}-${Date.now()}`
}

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const MAX_ATTACHMENT_SIZE = 500 * 1024 // 500KB

function stripLargeDataUris(text: string): string {
  const dataUriPattern = /!\[([^\]]*)\]\(data:(image\/[^;]+);base64,([^)]+)\)/g

  return text.replace(dataUriPattern, (match, alt, _mimeType, base64Data) => {
    const cleanedBase64 = base64Data.replace(/\s/g, '')
    const estimatedSize = (cleanedBase64.length * 3) / 4

    if (estimatedSize > MAX_ATTACHMENT_SIZE) {
      const sizeKB = Math.round(estimatedSize / 1024)
      return `[Image too large: ${alt || 'image.png'} (~${sizeKB}KB)]`
    }

    return match
  })
}

function filterLargeAttachments(attachments?: ChatAttachment[]): ChatAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined

  const filtered = attachments.filter(att => {
    if (!att.content) return true
    const size = (att.content.length * 3) / 4
    if (size > MAX_ATTACHMENT_SIZE) {
      console.warn(`[useChat] Filtered out large attachment: ${att.fileName || 'unknown'} (~${Math.round(size / 1024)}KB)`)
      return false
    }
    return true
  })

  return filtered.length > 0 ? filtered : undefined
}

/**
 * Strip the gateway's system preamble injected before user messages.
 * Matches everything from the start up through the metadata JSON block
 * and optional timestamp prefix, regardless of what comes before it.
 */
function stripGatewayPreamble(text: string): string {
  // Find "Conversation info (untrusted metadata):" anywhere from the start
  const marker = 'Conversation info (untrusted metadata):'
  const idx = text.indexOf(marker)
  if (idx === -1) return text

  // Only strip if the marker is near the start (within first 500 chars — it's a preamble)
  if (idx > 500) return text

  // Find the closing brace of the JSON block after the marker
  const afterMarker = text.indexOf('{', idx + marker.length)
  if (afterMarker === -1) return text

  // Find matching closing brace — track strings to avoid counting braces inside JSON string values
  let braceDepth = 0
  let jsonEnd = -1
  let inString = false
  let escaped = false
  for (let i = afterMarker; i < text.length; i++) {
    const ch = text[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\' && inString) { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') braceDepth++
    else if (ch === '}') {
      braceDepth--
      if (braceDepth === 0) { jsonEnd = i; break }
    }
  }

  // If we couldn't find matching braces, bail — return original
  if (jsonEnd === -1) return text

  // Skip past the JSON block and any trailing whitespace/newlines
  let start = jsonEnd + 1
  while (start < text.length && /[\s]/.test(text[start])) {
    start++
  }

  // Skip optional timestamp like [Fri 2026-02-20 01:12 CST] or [2026-02-20T...]
  if (start < text.length && text[start] === '[') {
    const closeBracket = text.indexOf(']', start)
    if (closeBracket !== -1 && closeBracket - start < 60) {
      const bracket = text.slice(start, closeBracket + 1)
      if (/\d{4}[-/]\d{2}[-/]\d{2}/.test(bracket)) {
        start = closeBracket + 1
        // Skip trailing whitespace after timestamp
        while (start < text.length && /[\s]/.test(text[start])) start++
      }
    }
  }

  // Safety: if stripping would leave nothing, return original
  const result = text.slice(start).trim()
  if (!result) return text

  return result
}

/**
 * Strip standalone timestamp prefix like [Fri 2026-02-20 01:12 CST]
 * that appears at the start of messages without the full preamble.
 */
function stripTimestampPrefix(text: string): string {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('[')) return text
  const closeBracket = trimmed.indexOf(']')
  if (closeBracket === -1 || closeBracket > 60) return text
  // Verify it looks like a timestamp (contains a date-like pattern)
  const bracket = trimmed.slice(0, closeBracket + 1)
  if (!/\d{4}[-/]\d{2}[-/]\d{2}/.test(bracket)) return text
  const result = trimmed.slice(closeBracket + 1).trim()
  return result || text
}

function extractText(msg: ChatMessage): string {
  if (!msg || !msg.content) return ''
  if (typeof msg.content === 'string') return stripTimestampPrefix(stripGatewayPreamble(stripLargeDataUris(msg.content)))
  if (!Array.isArray(msg.content) || msg.content.length === 0) return ''
  const text = msg.content
    .filter((b) => b && b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('')
  return stripTimestampPrefix(stripGatewayPreamble(stripLargeDataUris(text)))
}

export function useChat(
  client: GatewayClient | null,
  status: ConnectionStatus,
  activeSessionKey: string,
  settings?: AppSettings,
  modelOverride?: string,
): ChatHandle {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [approvalRequests, setApprovalRequests] = useState<ToolApprovalRequest[]>([])
  const activeRunIdRef = useRef<string | null>(null)
  const sessionKeyRef = useRef(activeSessionKey)
  const messagesCacheRef = useRef<Map<string, DisplayMessage[]>>(new Map())
  const wasStreamingRef = useRef(false)
  const settingsRef = useRef(settings)
  const modelOverrideRef = useRef(modelOverride)
  settingsRef.current = settings
  modelOverrideRef.current = modelOverride

  sessionKeyRef.current = activeSessionKey

  // Cache current messages when they change
  useEffect(() => {
    if (activeSessionKey && messages.length > 0) {
      messagesCacheRef.current.set(activeSessionKey, messages)
    }
  }, [activeSessionKey, messages])

  // Notification on completion
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      // Streaming just ended
      if (document.hidden && settingsRef.current?.notifyOnComplete !== false) {
        try {
          new Notification('Gideon', { body: 'Response complete' })
        } catch { /* notification permission not granted */ }
        try {
          window.api.flashFrame()
        } catch { /* IPC not available */ }
      }
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming])

  // Subscribe to chat events
  useEffect(() => {
    if (!client) return

    const unsub = client.on('chat', (payload) => {
      const ev = payload as unknown as ChatEventPayload
      if (ev.sessionKey !== sessionKeyRef.current) return

      if (ev.state === 'delta') {
        const text = extractText(ev.message)
        const attachments = filterLargeAttachments(ev.message.attachments)
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.streaming && m.role === 'assistant')
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], text, attachments, streaming: true }
            return updated
          }
          return [...prev, {
            id: newMsgId(),
            role: 'assistant' as const,
            text,
            attachments,
            streaming: true,
          }]
        })
      } else if (ev.state === 'final') {
        const text = extractText(ev.message)
        const attachments = filterLargeAttachments(ev.message.attachments)
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.streaming && m.role === 'assistant')
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              text,
              attachments,
              streaming: false,
              timestamp: ev.message.timestamp,
            }
            return updated
          }
          return [...prev, {
            id: newMsgId(),
            role: 'assistant' as const,
            text,
            attachments,
            timestamp: ev.message.timestamp,
            streaming: false,
          }]
        })
        activeRunIdRef.current = null
        setIsStreaming(false)
      } else if (ev.state === 'error') {
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

    return unsub
  }, [client])

  // Subscribe to exec.approval.request events (tool approval)
  useEffect(() => {
    if (!client) return

    const unsub = client.on('exec.approval.request', (payload) => {
      const req = payload as unknown as {
        requestId: string
        toolName: string
        args?: Record<string, unknown>
        sessionKey: string
      }

      // Only process for active session
      if (req.sessionKey !== sessionKeyRef.current) return

      // If tool approval is disabled, auto-approve
      if (!settingsRef.current?.toolApprovalEnabled) {
        client.call('exec.approval.respond', {
          requestId: req.requestId,
          approved: true,
        }).catch((err) => console.error('[useChat] Failed to auto-approve:', err))
        return
      }

      setApprovalRequests((prev) => [...prev, {
        requestId: req.requestId,
        toolName: req.toolName,
        args: req.args,
        sessionKey: req.sessionKey,
      }])
    })

    return unsub
  }, [client])

  const respondToApproval = useCallback((requestId: string, approved: boolean) => {
    if (!client || status !== 'connected') return
    client.call('exec.approval.respond', { requestId, approved })
      .catch((err) => console.error('[useChat] Failed to respond to approval:', err))
    setApprovalRequests((prev) => prev.filter((r) => r.requestId !== requestId))
  }, [client, status])

  // Load history when session changes
  const loadHistory = useCallback(async (sessionKey: string) => {
    if (!client || status !== 'connected') return

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

      setMessages(history)
      messagesCacheRef.current.set(sessionKey, history)
    } catch (err) {
      console.error('[useChat] Failed to load history:', err)
      if (!cached) {
        setMessages([])
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [client, status])

  const lastLoadedSessionRef = useRef<string | null>(null)

  useEffect(() => {
    if (status === 'connected' && activeSessionKey) {
      const isDifferentSession = lastLoadedSessionRef.current !== activeSessionKey
      const hasNoCache = !messagesCacheRef.current.has(activeSessionKey)

      if (isDifferentSession || hasNoCache) {
        void loadHistory(activeSessionKey)
        lastLoadedSessionRef.current = activeSessionKey
      }
    } else if (!activeSessionKey) {
      setMessages([])
      lastLoadedSessionRef.current = null
    }

    activeRunIdRef.current = null
    setIsStreaming(false)
    setApprovalRequests([])
  }, [activeSessionKey, status, loadHistory])

  const send = useCallback(async (text: string, attachments?: ChatAttachment[]) => {
    if (!client || status !== 'connected' || !text.trim()) return

    const userMsg: DisplayMessage = {
      id: newMsgId(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
      attachments,
    }
    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)

    try {
      const params: {
        sessionKey: string
        message: string
        idempotencyKey: string
        thinking?: string
        model?: string
        attachments?: ChatAttachment[]
      } = {
        sessionKey: sessionKeyRef.current,
        message: text.trim(),
        idempotencyKey: uuid(),
      }

      // Include thinking level if not off
      if (settingsRef.current?.thinkingLevel && settingsRef.current.thinkingLevel !== 'off') {
        params.thinking = settingsRef.current.thinkingLevel
      }

      // Include model override if set
      if (modelOverrideRef.current) {
        params.model = modelOverrideRef.current
      }

      if (attachments && attachments.length > 0) {
        params.attachments = attachments
      }

      const ack = await client.call('chat.send', params) as unknown as ChatSendAck

      activeRunIdRef.current = ack.runId ?? null
    } catch (err) {
      console.error('[useChat] Failed to send:', err)

      let errorMsg = err instanceof Error ? err.message : 'Failed to send message'

      if (errorMsg.includes('1009') || errorMsg.toLowerCase().includes('too large')) {
        const maxPayloadBytes = client?.getMaxPayload() || 1048576
        const maxPayloadMB = (maxPayloadBytes / (1024 * 1024)).toFixed(1)
        errorMsg = `**📎 File too large to send**\n\nThis attachment exceeds the ${maxPayloadMB}MB gateway limit.\n\n**Quick fix:** Try compressing or resizing the image first.\n\n**Advanced:** You can increase the gateway limit by editing \`~/.openclaw/openclaw.json\` - see docs.openclaw.ai for details.`
      }

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
      console.error('[useChat] Failed to abort:', err)
    }
  }, [client, status])

  return {
    messages,
    send,
    abort,
    loadHistory,
    isStreaming,
    historyLoading,
    approvalRequests,
    respondToApproval,
  }
}
