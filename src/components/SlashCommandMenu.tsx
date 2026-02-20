import { useEffect, useRef } from 'react'

export interface SlashCommand {
  command: string
  description: string
}

interface SlashCommandMenuProps {
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: string) => void
  position: { top: number; left: number }
}

export function SlashCommandMenu({ commands, selectedIndex, onSelect, position }: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll selected item into view
    if (menuRef.current) {
      const selected = menuRef.current.children[selectedIndex] as HTMLElement
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (commands.length === 0) return null

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        bottom: position.top,
        left: position.left,
        backgroundColor: '#16213e',
        border: '1px solid #2a2a4a',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        maxHeight: '300px',
        overflowY: 'auto',
        minWidth: '280px',
        zIndex: 1000,
      }}
    >
      {commands.map((cmd, index) => (
        <div
          key={cmd.command}
          onClick={() => onSelect(cmd.command)}
          style={{
            padding: '0.625rem 0.875rem',
            cursor: 'pointer',
            backgroundColor: index === selectedIndex ? '#2a2a4a' : 'transparent',
            borderBottom: index < commands.length - 1 ? '1px solid #2a2a4a' : 'none',
            transition: 'background-color 0.1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2a2a4a'
          }}
          onMouseLeave={(e) => {
            if (index !== selectedIndex) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <div style={{
            color: '#f59e0b',
            fontSize: '0.875rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            marginBottom: '0.125rem',
          }}>
            {cmd.command}
          </div>
          <div style={{
            color: '#a0a0a0',
            fontSize: '0.75rem',
          }}>
            {cmd.description}
          </div>
        </div>
      ))}
    </div>
  )
}
