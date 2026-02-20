import { useEffect, useRef, useCallback } from 'react'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { ToolApprovalCard } from './ToolApprovalCard'
import type { DisplayMessage } from '../hooks/useChat'
import type { ConnectionStatus } from '../types/protocol'
import type { ToolApprovalRequest } from './ToolApprovalCard'
import { GIDEON_AVATAR } from '../constants'

interface ChatViewProps {
  messages: DisplayMessage[]
  isStreaming: boolean
  historyLoading: boolean
  status: ConnectionStatus
  onSend: (text: string) => void
  onAbort: () => void
  showStreamToggle?: boolean
  streamOpen?: boolean
  onToggleStream?: () => void
  streamCount?: number
  approvalRequests?: ToolApprovalRequest[]
  onRespondApproval?: (requestId: string, approved: boolean) => void
  assistantName?: string
}

export function ChatView({
  messages,
  isStreaming,
  historyLoading,
  status,
  onSend,
  onAbort,
  showStreamToggle,
  streamOpen,
  onToggleStream,
  streamCount,
  approvalRequests,
  onRespondApproval,
  assistantName = 'Assistant',
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

  // Auto-scroll on new messages if user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom()
    }
  }, [messages, approvalRequests, scrollToBottom])

  // Scroll to bottom on history load
  useEffect(() => {
    if (!historyLoading && messages.length > 0) {
      scrollToBottom()
    }
  }, [historyLoading, messages.length, scrollToBottom])

  const isDisabled = status !== 'connected'

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Stream toggle button */}
      {showStreamToggle && (
        <button
          onClick={onToggleStream}
          title={streamOpen ? 'Hide stream' : 'Show stream'}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.75rem',
            zIndex: 10,
            padding: '0.3rem 0.6rem',
            backgroundColor: streamOpen ? '#2a2a4a' : '#16213e',
            border: '1px solid #2a2a4a',
            borderRadius: '6px',
            color: streamOpen ? '#e0e0e0' : '#888',
            fontSize: '0.7rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <span style={{ fontSize: '0.8rem' }}>{'{ }'}</span>
          Stream
          {(streamCount ?? 0) > 0 && (
            <span style={{
              backgroundColor: '#f59e0b',
              color: '#fff',
              borderRadius: '8px',
              padding: '0 0.35rem',
              fontSize: '0.6rem',
              fontWeight: 700,
              minWidth: '14px',
              textAlign: 'center',
            }}>
              {streamCount}
            </span>
          )}
        </button>
      )}

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

        {!historyLoading && messages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
            gap: '0.5rem',
          }}>
            <img src={GIDEON_AVATAR} alt="Gideon" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
            <span style={{ fontSize: '0.9rem' }}>Send a message to get started!</span>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Tool approval cards */}
        {approvalRequests && onRespondApproval && approvalRequests.map((req) => (
          <ToolApprovalCard
            key={req.requestId}
            request={req}
            onRespond={onRespondApproval}
          />
        ))}

        {/* Typing indicator when streaming but no delta yet */}
        {isStreaming && !messages.some((m) => m.streaming) && (
          <div style={{
            padding: '0.25rem 1rem',
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <img
              src={GIDEON_AVATAR}
              alt={assistantName}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
            <div style={{
              padding: '0.625rem 0.875rem',
              borderRadius: '12px 12px 12px 2px',
              backgroundColor: '#16213e',
              border: '1px solid #2a2a4a',
              color: '#888',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}>
              <span style={{ fontSize: '0.75rem', color: '#aaa', marginRight: '0.35rem' }}>{assistantName}</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                    animation: `bounce-dots 1.4s ease-in-out ${i * 0.16}s infinite`,
                  }}
                />
              ))}
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
