import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { DisplayMessage } from '../hooks/useChat'
import type { ComponentPropsWithoutRef } from 'react'
import { MessageAttachment } from './MessageAttachment'
import { useMemo, useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface MessageBubbleProps {
  message: DisplayMessage
}

function formatTime(ts?: string | number): string {
  if (!ts) return ''
  try {
    const d = new Date(typeof ts === 'number' ? ts : ts)
    const now = new Date()
    const isToday = d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate()

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  // Extract data URI images from markdown and convert to attachments
  const { processedText, extractedAttachments } = useMemo(() => {
    if (!message.text) return { processedText: '', extractedAttachments: [] }

    const dataUriPattern = /!\[([^\]]*)\]\(data:(image\/[^;]+);base64,([^)]+)\)/g
    let text = message.text
    const extracted: Array<{
      type: string
      mimeType: string
      fileName: string
      content: string
    }> = []

    const matches = [...text.matchAll(dataUriPattern)]

    for (const match of matches) {
      const [fullMatch, alt, mimeType, base64Data] = match
      try {
        const cleanedBase64 = base64Data.replace(/\s/g, '')
        extracted.push({
          type: 'image',
          mimeType,
          fileName: alt || 'image.png',
          content: cleanedBase64,
        })
        text = text.replace(fullMatch, '')
      } catch (err) {
        console.error('[MessageBubble] Failed to extract data URI:', err)
      }
    }

    return { processedText: text.trim(), extractedAttachments: extracted }
  }, [message.text])

  const allAttachments = [...(message.attachments || []), ...extractedAttachments]

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-start',
        gap: isUser ? 0 : '0.5rem',
        padding: '0.25rem 1rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <img
          src="/MyGideon.png"
          alt="Gideon"
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
            marginTop: '1.1rem',
          }}
        />
      )}
      <div style={{ maxWidth: '75%', minWidth: '60px', display: 'flex', flexDirection: 'column' }}>
        {/* Name label */}
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#888',
          marginBottom: '0.15rem',
          textAlign: isUser ? 'right' : 'left',
        }}>
          {isUser ? 'Mark' : 'Gideon'}
        </div>
        <div style={{
          padding: '0.625rem 0.875rem',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        backgroundColor: isUser ? '#1e1a0e' : '#16213e',
        color: isUser ? '#ede0c8' : '#e0e0e0',
        border: isUser ? '1px solid #f59e0b' : '1px solid #2a2a4a',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        position: 'relative',
      }}>
        {/* Copy button */}
        {hovered && !message.streaming && message.text && (
          <button
            onClick={handleCopy}
            title="Copy message"
            style={{
              position: 'absolute',
              top: '0.35rem',
              right: '0.35rem',
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              borderRadius: '4px',
              color: copied ? '#22c55e' : '#888',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}

        {/* Error state */}
        {message.error && (
          <div style={{
            color: '#ef4444',
            fontSize: '0.8rem',
            padding: '0.25rem 0',
          }}>
            ⚠ {message.error}
          </div>
        )}

        {/* Attachments */}
        {allAttachments.length > 0 && (
          <div>
            {allAttachments.map((attachment, index) => (
              <MessageAttachment key={index} attachment={attachment} />
            ))}
          </div>
        )}

        {/* Message text with markdown */}
        {processedText && (
          <div style={{ overflow: 'hidden' }} className="msg-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code(props: ComponentPropsWithoutRef<'code'> & { inline?: boolean; className?: string }) {
                  const { inline, className, children, ...rest } = props
                  const match = /language-(\w+)/.exec(className || '')
                  if (!inline && match) {
                    return (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: '0.5rem 0',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                        }}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  }
                  return (
                    <code
                      {...rest}
                      className={className}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        padding: '0.15rem 0.35rem',
                        borderRadius: '3px',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      {children}
                    </code>
                  )
                },
                a(props: ComponentPropsWithoutRef<'a'>) {
                  return (
                    <a
                      {...props}
                      style={{ color: '#60a5fa', textDecoration: 'underline' }}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  )
                },
                p(props: ComponentPropsWithoutRef<'p'>) {
                  return <p {...props} style={{ margin: '0.35rem 0' }} />
                },
                ul(props: ComponentPropsWithoutRef<'ul'>) {
                  return <ul {...props} style={{ margin: '0.35rem 0', paddingLeft: '1.25rem' }} />
                },
                ol(props: ComponentPropsWithoutRef<'ol'>) {
                  return <ol {...props} style={{ margin: '0.35rem 0', paddingLeft: '1.25rem' }} />
                },
                blockquote(props: ComponentPropsWithoutRef<'blockquote'>) {
                  return (
                    <blockquote
                      {...props}
                      style={{
                        borderLeft: '3px solid #f59e0b',
                        margin: '0.35rem 0',
                        paddingLeft: '0.75rem',
                        color: '#aaa',
                      }}
                    />
                  )
                },
                img(props: ComponentPropsWithoutRef<'img'>) {
                  if (props.src?.startsWith('data:')) {
                    return null
                  }
                  return <img {...props} style={{ maxWidth: '100%', borderRadius: '6px' }} />
                },
              }}
            >
              {processedText}
            </ReactMarkdown>
          </div>
        )}

        {/* Streaming indicator — animated bar */}
        {message.streaming && (
          <div style={{
            position: 'relative',
            height: '3px',
            borderRadius: '2px',
            backgroundColor: 'rgba(232, 93, 4, 0.15)',
            marginTop: '0.4rem',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              height: '100%',
              borderRadius: '2px',
              backgroundColor: '#f59e0b',
              animation: 'streaming-bar 1.5s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Timestamp */}
        {message.timestamp && !message.streaming && (
          <div style={{
            fontSize: '0.65rem',
            color: isUser ? 'rgba(255,255,255,0.6)' : '#555',
            marginTop: '0.25rem',
            textAlign: 'right',
          }}>
            {formatTime(message.timestamp)}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
