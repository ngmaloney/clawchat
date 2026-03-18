import ReactMarkdown from 'react-markdown'
import { logger } from '../lib/logger'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { DisplayMessage } from '../hooks/useChat'
import type { ComponentPropsWithoutRef } from 'react'
import { MessageAttachment } from './MessageAttachment'
import { useMemo, useState } from 'react'

interface MessageBubbleProps {
  message: DisplayMessage
  botAvatar?: string
  botName?: string
}

function formatTime(ts?: string | number): string {
  if (!ts) return ''
  try {
    const d = new Date(typeof ts === 'number' ? ts : ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      style={{
        position: 'absolute',
        top: '0.375rem',
        right: '0.375rem',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        color: '#aaa',
        fontSize: '0.7rem',
        padding: '0.2rem 0.5rem',
        cursor: 'pointer',
        opacity: 0.6,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '0.6' }}
      title="Copy code"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

function BotAvatar({ src, name }: { src?: string; name?: string }) {
  const avatarSrc = src || 'icon.png'
  const isEmoji = !src || (!src.startsWith('http') && !src.startsWith('data:') && !src.includes('/') && src.length <= 4)

  return (
    <div style={{
      width: '24px',
      height: '24px',
      minWidth: '24px',
      borderRadius: '50%',
      overflow: 'hidden',
      marginRight: '0.5rem',
      marginTop: '0.125rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isEmoji ? '#2a2a4a' : undefined,
      fontSize: isEmoji ? '14px' : undefined,
    }}>
      {isEmoji ? (
        <span>{src || '🤖'}</span>
      ) : (
        <img
          src={avatarSrc}
          alt={name || 'Assistant'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.currentTarget.src = 'icon.png' }}
        />
      )}
    </div>
  )
}

export function MessageBubble({ message, botAvatar, botName }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Extract data URI images from markdown and convert to attachments
  // (Large data URIs are already stripped by useChat hook)
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
        logger.warn('Failed to parse image data from message:', err)
      }
    }
    
    return { processedText: text.trim(), extractedAttachments: extracted }
  }, [message.text])

  // Combine original attachments with extracted ones
  const allAttachments = [...(message.attachments || []), ...extractedAttachments]

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      padding: '0.375rem 1rem',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Bot avatar */}
      {!isUser && <BotAvatar src={botAvatar} name={botName} />}

      <div style={{
        maxWidth: isUser ? '75%' : '80%',
        minWidth: '60px',
        padding: isUser ? '0.5rem 0.875rem' : '0.75rem 1rem',
        borderRadius: isUser ? '16px 16px 4px 16px' : '2px 16px 16px 16px',
        backgroundColor: isUser ? '#e85d04' : '#1a1f35',
        color: isUser ? '#fff' : '#e0e0e0',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.875rem',
        lineHeight: 1.6,
        wordBreak: 'break-word',
        position: 'relative',
        boxShadow: isUser
          ? '0 1px 3px rgba(232, 93, 4, 0.2)'
          : '0 1px 4px rgba(0, 0, 0, 0.3)',
      }}>
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
                  const codeString = String(children).replace(/\n$/, '')

                  // Block code (with or without language)
                  if (!inline && (match || codeString.includes('\n'))) {
                    return (
                      <div style={{ position: 'relative', margin: '0.625rem 0' }}>
                        {match && (
                          <div style={{
                            fontSize: '0.65rem',
                            color: '#888',
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#0d1117',
                            borderTopLeftRadius: '8px',
                            borderTopRightRadius: '8px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            fontFamily: 'monospace',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}>
                            {match[1]}
                          </div>
                        )}
                        <CopyButton text={codeString} />
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match ? match[1] : 'text'}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: match ? '0 0 8px 8px' : '8px',
                            fontSize: '0.8rem',
                            padding: '0.75rem',
                            backgroundColor: '#0d1117',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderTop: match ? 'none' : undefined,
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    )
                  }

                  // Inline code
                  return (
                    <code
                      {...rest}
                      className={className}
                      style={{
                        backgroundColor: 'rgba(232, 93, 4, 0.12)',
                        color: '#f0a070',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.82rem',
                        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                        border: '1px solid rgba(232, 93, 4, 0.15)',
                      }}
                    >
                      {children}
                    </code>
                  )
                },
                pre(props: ComponentPropsWithoutRef<'pre'>) {
                  // Let the code component handle all rendering
                  return <>{props.children}</>
                },
                a(props: ComponentPropsWithoutRef<'a'>) {
                  return (
                    <a
                      {...props}
                      style={{ color: '#60a5fa', textDecoration: 'none', borderBottom: '1px solid rgba(96, 165, 250, 0.3)' }}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  )
                },
                p(props: ComponentPropsWithoutRef<'p'>) {
                  return <p {...props} style={{ margin: '0.4rem 0' }} />
                },
                ul(props: ComponentPropsWithoutRef<'ul'>) {
                  return <ul {...props} style={{ margin: '0.4rem 0', paddingLeft: '1.25rem' }} />
                },
                ol(props: ComponentPropsWithoutRef<'ol'>) {
                  return <ol {...props} style={{ margin: '0.4rem 0', paddingLeft: '1.25rem' }} />
                },
                li(props: ComponentPropsWithoutRef<'li'>) {
                  return <li {...props} style={{ margin: '0.2rem 0' }} />
                },
                blockquote(props: ComponentPropsWithoutRef<'blockquote'>) {
                  return (
                    <blockquote
                      {...props}
                      style={{
                        borderLeft: '3px solid #e85d04',
                        margin: '0.5rem 0',
                        paddingLeft: '0.75rem',
                        color: '#999',
                        fontStyle: 'italic',
                      }}
                    />
                  )
                },
                h1(props: ComponentPropsWithoutRef<'h1'>) {
                  return <h1 {...props} style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.75rem 0 0.375rem', color: '#fff' }} />
                },
                h2(props: ComponentPropsWithoutRef<'h2'>) {
                  return <h2 {...props} style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.625rem 0 0.3rem', color: '#fff' }} />
                },
                h3(props: ComponentPropsWithoutRef<'h3'>) {
                  return <h3 {...props} style={{ fontSize: '1rem', fontWeight: 600, margin: '0.5rem 0 0.25rem', color: '#eee' }} />
                },
                strong(props: ComponentPropsWithoutRef<'strong'>) {
                  return <strong {...props} style={{ color: '#fff', fontWeight: 600 }} />
                },
                hr() {
                  return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0.75rem 0' }} />
                },
                table(props: ComponentPropsWithoutRef<'table'>) {
                  return (
                    <div style={{ overflowX: 'auto', margin: '0.5rem 0' }}>
                      <table {...props} style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem' }} />
                    </div>
                  )
                },
                th(props: ComponentPropsWithoutRef<'th'>) {
                  return (
                    <th {...props} style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '0.4rem 0.6rem',
                      textAlign: 'left',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      fontWeight: 600,
                      color: '#fff',
                    }} />
                  )
                },
                td(props: ComponentPropsWithoutRef<'td'>) {
                  return (
                    <td {...props} style={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '0.4rem 0.6rem',
                      textAlign: 'left',
                    }} />
                  )
                },
                img(props: ComponentPropsWithoutRef<'img'>) {
                  // Block data URI images from being rendered by ReactMarkdown
                  // (they should be extracted and rendered as attachments)
                  if (props.src?.startsWith('data:')) {
                    return null
                  }
                  return <img {...props} style={{ maxWidth: '100%', borderRadius: '8px', margin: '0.25rem 0' }} />
                },
              }}
            >
              {processedText}
            </ReactMarkdown>
          </div>
        )}

        {/* Streaming indicator */}
        {message.streaming && (
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '14px',
            backgroundColor: '#e85d04',
            marginLeft: '2px',
            animation: 'blink 1s step-end infinite',
            verticalAlign: 'text-bottom',
          }} />
        )}

        {/* Timestamp */}
        {message.timestamp && !message.streaming && (
          <div style={{
            fontSize: '0.625rem',
            color: isUser ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
            marginTop: '0.375rem',
            textAlign: 'right',
          }}>
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  )
}
