import { useState } from 'react'
import { X, Settings, Monitor, MessageSquare, Info } from 'lucide-react'
import type { AppSettings } from '../hooks/useSettings'
import type { ModelInfo, AgentInfo } from '../hooks/useGatewayCapabilities'

type Tab = 'general' | 'model' | 'session' | 'about'

interface SettingsScreenProps {
  settings: AppSettings
  onUpdateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  models: ModelInfo[]
  agents: AgentInfo[]
  onClose: () => void
}

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'model', label: 'Model', icon: Monitor },
  { id: 'session', label: 'Session', icon: MessageSquare },
  { id: 'about', label: 'About', icon: Info },
]

function Select({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '0.4rem 0.6rem',
        backgroundColor: '#1a1a2e',
        border: '1px solid #2a2a4a',
        borderRadius: '6px',
        color: '#e0e0e0',
        fontSize: '0.8rem',
        outline: 'none',
        minWidth: '180px',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        backgroundColor: checked ? '#f59e0b' : '#2a2a4a',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '2px',
        left: checked ? '18px' : '2px',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

function SettingRow({ label, description, children }: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 0',
      borderBottom: '1px solid #1a1a2e',
      gap: '1rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.2rem' }}>{description}</div>
        )}
      </div>
      {children}
    </div>
  )
}

function GeneralTab({ settings, onUpdateSetting }: {
  settings: AppSettings
  onUpdateSetting: SettingsScreenProps['onUpdateSetting']
}) {
  return (
    <div>
      <SettingRow
        label="Notify on completion"
        description="Show a notification when a response completes while the window is hidden"
      >
        <Toggle
          checked={settings.notifyOnComplete}
          onChange={(v) => onUpdateSetting('notifyOnComplete', v)}
        />
      </SettingRow>
      <SettingRow
        label="Tool approval"
        description="Show approval prompts when the agent wants to use tools (off = auto-approve)"
      >
        <Toggle
          checked={settings.toolApprovalEnabled}
          onChange={(v) => onUpdateSetting('toolApprovalEnabled', v)}
        />
      </SettingRow>

      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, marginBottom: '0.5rem' }}>
          Keyboard Shortcuts
        </div>
        <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {[
            ['Cmd/Ctrl+N', 'New session'],
            ['Cmd/Ctrl+[', 'Previous session'],
            ['Cmd/Ctrl+]', 'Next session'],
            ['Cmd/Ctrl+E', 'Export conversation'],
            ['Cmd/Ctrl+,', 'Open settings'],
            ['Escape', 'Close panels / settings'],
          ].map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>{desc}</span>
              <code style={{
                backgroundColor: '#1a1a2e',
                padding: '0.1rem 0.4rem',
                borderRadius: '3px',
                fontSize: '0.7rem',
              }}>{key}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ModelTab({ settings, onUpdateSetting, models, agents }: {
  settings: AppSettings
  onUpdateSetting: SettingsScreenProps['onUpdateSetting']
  models: ModelInfo[]
  agents: AgentInfo[]
}) {
  return (
    <div>
      <SettingRow label="Default model" description="Model to use for new sessions">
        <Select
          value={settings.defaultModel ?? ''}
          onChange={(v) => onUpdateSetting('defaultModel', v || undefined)}
          options={models.map((m) => ({ value: m.id, label: m.name || m.id }))}
          placeholder="Gateway default"
        />
      </SettingRow>
      <SettingRow label="Thinking level" description="Controls how much the model reasons before responding">
        <Select
          value={settings.thinkingLevel}
          onChange={(v) => onUpdateSetting('thinkingLevel', v as AppSettings['thinkingLevel'])}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </SettingRow>
      {agents.length > 0 && (
        <SettingRow label="Default agent" description="Agent to use for new sessions">
          <Select
            value={settings.defaultAgent ?? ''}
            onChange={(v) => onUpdateSetting('defaultAgent', v || undefined)}
            options={agents.map((a) => ({ value: a.id, label: a.name || a.id }))}
            placeholder="Default agent"
          />
        </SettingRow>
      )}
    </div>
  )
}

function SessionTab() {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', color: '#666', padding: '1rem 0' }}>
        Session settings are managed per-session via slash commands:
      </div>
      <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {[
          ['/compact', 'Compact the current session context'],
          ['/reset', 'Reset the current session'],
          ['/status', 'Show session status and token usage'],
        ].map(([cmd, desc]) => (
          <div key={cmd} style={{ display: 'flex', gap: '0.75rem' }}>
            <code style={{
              backgroundColor: '#1a1a2e',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              fontSize: '0.7rem',
              flexShrink: 0,
            }}>{cmd}</code>
            <span style={{ color: '#888' }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AboutTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/MyGideon.png" alt="Gideon" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginTop: '0.5rem' }}>
          Gideon
        </div>
        <div style={{ fontSize: '0.75rem', color: '#666' }}>
          v0.1.1
        </div>
      </div>
      <div style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>
        Desktop client for OpenClaw Gateway
      </div>
      <div style={{ fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>
        Built with Electron + React + Vite
      </div>
    </div>
  )
}

export function SettingsScreen({ settings, onUpdateSetting, models, agents, onClose }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general')

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxHeight: '80vh',
          backgroundColor: '#16213e',
          border: '1px solid #2a2a4a',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #2a2a4a',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>Settings</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #2a2a4a',
          flexShrink: 0,
        }}>
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.6rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #f59e0b' : '2px solid transparent',
                  color: isActive ? '#e0e0e0' : '#666',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '1rem 1.25rem',
        }}>
          {activeTab === 'general' && (
            <GeneralTab settings={settings} onUpdateSetting={onUpdateSetting} />
          )}
          {activeTab === 'model' && (
            <ModelTab settings={settings} onUpdateSetting={onUpdateSetting} models={models} agents={agents} />
          )}
          {activeTab === 'session' && <SessionTab />}
          {activeTab === 'about' && <AboutTab />}
        </div>
      </div>
    </div>
  )
}
