import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, Settings, RotateCcw } from 'lucide-react'
import type { SessionInfo } from '../types/protocol'

interface SidebarProps {
  sessions: SessionInfo[]
  activeSessionKey: string
  onSelectSession: (key: string) => void
  onNewSession: () => void
  onRenameSession: (key: string, label: string) => void
  onDeleteSession: (key: string) => void
  onOpenSettings: () => void
  loading: boolean
}

function sessionLabel(s: SessionInfo): string {
  if (s.label) return s.label
  const parts = s.key.split(':')
  if (parts.length >= 3) {
    if (parts[2] === 'main') return 'Gideon'
    const name = parts[2]
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} Agent`
  }
  return s.key
}

function SessionItem({ session, isActive, onSelect, onRename, onDelete }: {
  session: SessionInfo
  isActive: boolean
  onSelect: () => void
  onRename: (label: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const contextRef = useRef<HTMLDivElement>(null)

  const label = sessionLabel(session)

  const startEditing = useCallback(() => {
    setEditing(true)
    setEditValue(label)
    setShowContextMenu(false)
  }, [label])

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== label) {
      onRename(trimmed)
    }
    setEditing(false)
  }, [editValue, label, onRename])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // Close context menu on outside click
  useEffect(() => {
    if (!showContextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setShowContextMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showContextMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  return (
    <>
      <button
        onClick={onSelect}
        onDoubleClick={startEditing}
        onContextMenu={handleContextMenu}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          padding: '0.5rem 0.625rem',
          marginBottom: '0.25rem',
          backgroundColor: isActive ? '#1a1a2e' : 'transparent',
          border: isActive ? '1px solid #2a2a4a' : '1px solid transparent',
          borderRadius: '6px',
          color: isActive ? '#fff' : '#888',
          fontSize: '0.8rem',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s',
          boxSizing: 'border-box',
        }}
      >
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isActive ? '#22c55e' : '#555',
          flexShrink: 0,
          marginTop: '0.25rem',
        }} />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          minWidth: 0,
        }}>
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setEditing(false)
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#0f1629',
                border: '1px solid #f59e0b',
                borderRadius: '3px',
                color: '#e0e0e0',
                fontSize: '0.8rem',
                padding: '0.15rem 0.3rem',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <span style={{ wordBreak: 'break-word', lineHeight: '1.2' }}>
              {label}
            </span>
          )}
          {session.model && (
            <span style={{ fontSize: '0.65rem', color: '#666', lineHeight: '1.2' }}>
              {session.model}
            </span>
          )}
        </div>
      </button>

      {/* Context menu */}
      {showContextMenu && (
        <div
          ref={contextRef}
          style={{
            position: 'fixed',
            top: contextPos.y,
            left: contextPos.x,
            backgroundColor: '#16213e',
            border: '1px solid #2a2a4a',
            borderRadius: '6px',
            zIndex: 200,
            minWidth: '120px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => { startEditing(); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'none',
              border: 'none',
              color: '#ccc',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Rename
          </button>
          <button
            onClick={() => {
              setShowContextMenu(false)
              onDelete()
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'none',
              border: 'none',
              color: '#ef4444',
              fontSize: '0.8rem',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <RotateCcw size={12} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} />
            Reset
          </button>
        </div>
      )}
    </>
  )
}

export function Sidebar({
  sessions,
  activeSessionKey,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onOpenSettings,
  loading,
}: SidebarProps) {
  return (
    <div style={{
      width: '200px',
      minWidth: '140px',
      flexShrink: 0,
      backgroundColor: '#0f1629',
      borderRight: '1px solid #2a2a4a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #2a2a4a',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff', flex: 1 }}>
          Sessions
        </span>
        <button
          onClick={onNewSession}
          title="New session (Cmd+N)"
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            padding: '0.15rem',
            display: 'flex',
            borderRadius: '3px',
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Session list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem',
      }}>
        {loading && (
          <div style={{
            textAlign: 'center',
            color: '#555',
            padding: '1rem',
            fontSize: '0.8rem',
          }}>
            Loading…
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#555',
            padding: '1rem',
            fontSize: '0.8rem',
          }}>
            No sessions
          </div>
        )}

        {sessions.map((s) => (
          <SessionItem
            key={s.key}
            session={s}
            isActive={s.key === activeSessionKey}
            onSelect={() => onSelectSession(s.key)}
            onRename={(label) => onRenameSession(s.key, label)}
            onDelete={() => onDeleteSession(s.key)}
          />
        ))}
      </div>

      {/* Footer — settings gear */}
      <div style={{
        borderTop: '1px solid #2a2a4a',
        padding: '0.5rem',
        flexShrink: 0,
      }}>
        <button
          onClick={onOpenSettings}
          title="Settings (Cmd+,)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            width: '100%',
            padding: '0.4rem 0.625rem',
            background: 'none',
            border: 'none',
            color: '#666',
            fontSize: '0.8rem',
            cursor: 'pointer',
            borderRadius: '6px',
          }}
        >
          <Settings size={14} />
          Settings
        </button>
      </div>
    </div>
  )
}
