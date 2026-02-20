import type { AppSettings } from '../hooks/useSettings'

type ThinkingLevel = AppSettings['thinkingLevel']

interface ThinkingToggleProps {
  level: ThinkingLevel
  onChange: (level: ThinkingLevel) => void
}

const LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Lo' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'Hi' },
]

export function ThinkingToggle({ level, onChange }: ThinkingToggleProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.15rem',
      backgroundColor: '#0f1629',
      borderRadius: '4px',
      padding: '1px',
      flexShrink: 0,
    }}>
      {LEVELS.map((l) => {
        const isActive = level === l.value
        return (
          <button
            key={l.value}
            onClick={() => onChange(l.value)}
            title={`Thinking: ${l.value}`}
            style={{
              padding: '0.1rem 0.35rem',
              fontSize: '0.65rem',
              borderRadius: '3px',
              border: 'none',
              backgroundColor: isActive ? '#f59e0b' : 'transparent',
              color: isActive ? '#fff' : '#555',
              cursor: 'pointer',
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}
