import { useMemo, useEffect, useRef, useCallback } from 'react'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { isSentinelMessage } from '../lib/sentinel'
import type { DisplayMessage } from '../hooks/useChat'
import type { ConnectionStatus } from '../types/protocol'

interface ChatViewProps {
  messages: DisplayMessage[]
  isStreaming: boolean
  historyLoading: boolean
  status: ConnectionStatus
  onSend: (text: string) => void
  onAbort: () => void
  botAvatar?: string
  botName?: string
}

export function ChatView({
  messages,
  isStreaming,
  historyLoading,
  status,
  onSend,
  onAbort,
  botAvatar,
  botName,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)

  const checkNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const threshold = 100
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  // Filter out agent sentinel messages (HEARTBEAT_OK, NO_REPLY) at the
  // rendering layer — raw data is preserved in the hook / cache.
  const visibleMessages = useMemo(
    () => messages.filter((msg) => !isSentinelMessage(msg.text)),
    [messages],
  )

  // Auto-scroll on new messages if user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom()
    }
  }, [visibleMessages, scrollToBottom])

  // Scroll to bottom on history load
  useEffect(() => {
    if (!historyLoading && visibleMessages.length > 0) {
      scrollToBottom()
    }
  }, [historyLoading, visibleMessages.length, scrollToBottom])

  const isDisabled = status !== 'connected'

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      overflow: 'hidden',
    }}>
      {/* Messages list */}
      <div
        ref={scrollRef}
        onScroll={checkNearBottom}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        {historyLoading && (
          <div style={{
            textAlign: 'center',
            color: '#555',
            padding: '2rem',
            fontSize: '0.85rem',
          }}>
            Loading history…
          </div>
        )}

        {!historyLoading && visibleMessages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
            gap: '0.5rem',
          }}>
            <span style={{ fontSize: '3rem' }}>🦀</span>
            <span style={{ fontSize: '0.9rem' }}>Send a message to get started!</span>
          </div>
        )}

        {visibleMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} botAvatar={botAvatar} botName={botName} />
        ))}

        {/* Typing indicator when streaming but no delta yet */}
        {isStreaming && !visibleMessages.some((m) => m.streaming) && (
          <div style={{
            padding: '0.25rem 1rem',
            display: 'flex',
            justifyContent: 'flex-start',
          }}>
            <div style={{
              padding: '0.625rem 0.875rem',
              borderRadius: '12px 12px 12px 2px',
              backgroundColor: '#16213e',
              border: '1px solid #2a2a4a',
              color: '#888',
              fontSize: '0.85rem',
            }}>
              <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                🦀 Thinking…
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <MessageInput
        onSend={onSend}
        onAbort={onAbort}
        isStreaming={isStreaming}
        disabled={isDisabled}
      />
    </div>
  )
}
