import { useState, useRef, useEffect } from 'react'
import type { StreamEntry } from '../hooks/useStreamLog'

interface StreamPanelProps {
  entries: StreamEntry[]
  onClear: () => void
  onClose: () => void
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function eventLabel(entry: StreamEntry): string {
  const parts = [entry.event]
  if (entry.state) parts.push(entry.state)
  if (entry.role) parts.push(entry.role)
  return parts.join(' · ')
}

function eventColor(entry: StreamEntry): string {
  if (entry.state === 'error') return '#ef4444'
  if (entry.state === 'final') return '#22c55e'
  if (entry.state === 'delta') return '#60a5fa'
  if (entry.event === 'agent') return '#a78bfa'
  if (entry.event === 'tick' || entry.event === 'health') return '#555'
  return '#f59e0b'
}

function contentTypeBadge(type: string): string {
  switch (type) {
    case 'text': return 'Text'
    case 'tool_use': return 'Tool Call'
    case 'tool_result': return 'Tool Result'
    case 'thinking': return 'Thinking'
    default: return type
  }
}

function UserPromptRow({ entry }: { entry: StreamEntry }) {
  const preview = entry.text
    ? (entry.text.length > 80 ? entry.text.slice(0, 80) + '…' : entry.text)
    : '(empty)'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.35rem 0.75rem',
      borderBottom: '1px solid #1a1a2e',
      backgroundColor: 'rgba(232, 93, 4, 0.05)',
    }}>
      <span style={{ color: '#555', flexShrink: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>
        {formatTs(entry.ts)}
      </span>
      <span style={{
        color: '#f59e0b',
        fontWeight: 600,
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        flexShrink: 0,
      }}>
        You
      </span>
      <span style={{
        color: '#999',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        minWidth: 0,
      }}>
        {preview}
      </span>
    </div>
  )
}

function AssistantEntryRow({ entry }: { entry: StreamEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasTokens = entry.tokens && (entry.tokens.input || entry.tokens.output)

  return (
    <div style={{
      borderBottom: '1px solid #1a1a2e',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.4rem 0.75rem',
          background: 'none',
          border: 'none',
          color: '#ccc',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color: '#555', flexShrink: 0 }}>{formatTs(entry.ts)}</span>
        <span style={{
          color: eventColor(entry),
          fontWeight: 600,
          flexShrink: 0,
        }}>
          {eventLabel(entry)}
        </span>

        {entry.contentTypes && (
          <span style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
            {entry.contentTypes.map((t, i) => (
              <span key={i} style={{
                padding: '0 0.3rem',
                borderRadius: '3px',
                backgroundColor: t === 'tool_use' ? '#4a2060' : t === 'thinking' ? '#2a3a20' : '#1a2a3e',
                color: t === 'tool_use' ? '#c084fc' : t === 'thinking' ? '#86efac' : '#7dd3fc',
                fontSize: '0.65rem',
              }}>
                {contentTypeBadge(t)}
              </span>
            ))}
          </span>
        )}

        {hasTokens && (
          <span style={{ color: '#666', marginLeft: 'auto', flexShrink: 0 }}>
            {entry.tokens!.input != null && `↑${entry.tokens!.input}`}
            {entry.tokens!.input != null && entry.tokens!.output != null && ' '}
            {entry.tokens!.output != null && `↓${entry.tokens!.output}`}
          </span>
        )}

        <span style={{ color: '#444', marginLeft: hasTokens ? '0' : 'auto', flexShrink: 0 }}>
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div style={{
          padding: '0.5rem 0.75rem',
          backgroundColor: '#0d1117',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          color: '#8b949e',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: '300px',
          overflow: 'auto',
        }}>
          {entry.text && (
            <div style={{ color: '#c9d1d9', marginBottom: '0.5rem' }}>
              {entry.text}
            </div>
          )}
          <details>
            <summary style={{ cursor: 'pointer', color: '#555' }}>Raw payload</summary>
            <pre style={{ margin: '0.25rem 0 0' }}>
              {JSON.stringify(entry.raw, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}

function EntryRow({ entry }: { entry: StreamEntry }) {
  if (entry.role === 'user') return <UserPromptRow entry={entry} />
  return <AssistantEntryRow entry={entry} />
}

export function StreamPanel({ entries, onClear, onClose }: StreamPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const chatEntries = entries.filter((e) => {
    // Always show exec events (tool calls)
    if (e.event === 'exec') return true
    // Show chat finals, errors, user prompts, and deltas that contain tool_use/tool_result
    if (e.event === 'chat') {
      if (e.state === 'final' || e.state === 'error' || e.role === 'user') return true
      if (e.contentTypes?.some(t => t === 'tool_use' || t === 'tool_result')) return true
    }
    return false
  })
  const allEntries = entries

  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? allEntries : chatEntries

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '400px',
      borderLeft: '1px solid #2a2a4a',
      backgroundColor: '#111827',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid #2a2a4a',
        flexShrink: 0,
      }}>
        <span style={{ color: '#ccc', fontSize: '0.8rem', fontWeight: 600 }}>
          Stream ({displayed.length})
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#666', fontSize: '0.7rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              style={{ width: '12px', height: '12px' }}
            />
            All
          </label>
          <button
            onClick={onClear}
            style={{
              padding: '0.2rem 0.4rem',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a4a',
              borderRadius: '3px',
              color: '#666',
              fontSize: '0.65rem',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.2rem 0.4rem',
              backgroundColor: 'transparent',
              border: '1px solid #2a2a4a',
              borderRadius: '3px',
              color: '#666',
              fontSize: '0.65rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {displayed.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#444', fontSize: '0.75rem' }}>
            No events yet
          </div>
        )}
        {displayed.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}
