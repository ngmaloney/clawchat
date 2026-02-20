import { useState, useRef, useEffect } from 'react'
import type { ModelInfo } from '../hooks/useGatewayCapabilities'

interface ModelSwitcherProps {
  currentModel?: string
  models: ModelInfo[]
  onSelect: (modelId: string) => void
}

export function ModelSwitcher({ currentModel, models, onSelect }: ModelSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          color: '#aaa',
          fontSize: '0.75rem',
          cursor: 'pointer',
          padding: '0.1rem 0.25rem',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
        title="Switch model"
      >
        {currentModel ?? 'unknown'}
        <span style={{ fontSize: '0.6rem', color: '#555' }}>&#9660;</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: '4px',
          backgroundColor: '#16213e',
          border: '1px solid #2a2a4a',
          borderRadius: '6px',
          minWidth: '200px',
          maxHeight: '240px',
          overflowY: 'auto',
          zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {models.length === 0 && (
            <div style={{ padding: '0.5rem 0.75rem', color: '#555', fontSize: '0.8rem' }}>
              No models available
            </div>
          )}
          {models.map((m) => {
            const isActive = m.id === currentModel
            return (
              <button
                key={m.id}
                onClick={() => {
                  onSelect(m.id)
                  setOpen(false)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: isActive ? '#1a1a2e' : 'none',
                  border: 'none',
                  color: isActive ? '#f59e0b' : '#ccc',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>{m.name || m.id}</div>
                {m.provider && (
                  <div style={{ fontSize: '0.65rem', color: '#555' }}>{m.provider}</div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
