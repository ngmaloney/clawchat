import { useState } from 'react'
import { Shield, Check, X } from 'lucide-react'

export interface ToolApprovalRequest {
  requestId: string
  toolName: string
  args?: Record<string, unknown>
  sessionKey: string
}

interface ToolApprovalCardProps {
  request: ToolApprovalRequest
  onRespond: (requestId: string, approved: boolean) => void
}

export function ToolApprovalCard({ request, onRespond }: ToolApprovalCardProps) {
  const [responded, setResponded] = useState(false)
  const [choice, setChoice] = useState<'approved' | 'denied' | null>(null)

  const handleRespond = (approved: boolean) => {
    setResponded(true)
    setChoice(approved ? 'approved' : 'denied')
    onRespond(request.requestId, approved)
  }

  const argsPreview = request.args
    ? JSON.stringify(request.args, null, 2).slice(0, 200)
    : null

  return (
    <div style={{
      padding: '0.25rem 1rem',
      display: 'flex',
      justifyContent: 'flex-start',
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '0.75rem 1rem',
        borderRadius: '12px 12px 12px 2px',
        backgroundColor: '#1a2040',
        border: '1px solid #3a3a6a',
        fontSize: '0.85rem',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          marginBottom: '0.5rem',
          color: '#f59e0b',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}>
          <Shield size={14} />
          Tool Approval Request
        </div>

        <div style={{
          backgroundColor: '#0d1117',
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          marginBottom: '0.5rem',
        }}>
          <div style={{ color: '#e0e0e0', fontSize: '0.8rem', fontWeight: 600 }}>
            {request.toolName}
          </div>
          {argsPreview && (
            <pre style={{
              color: '#8b949e',
              fontSize: '0.7rem',
              margin: '0.35rem 0 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
            }}>
              {argsPreview}
            </pre>
          )}
        </div>

        {responded ? (
          <div style={{
            fontSize: '0.75rem',
            color: choice === 'approved' ? '#22c55e' : '#ef4444',
            fontWeight: 600,
          }}>
            {choice === 'approved' ? 'Approved' : 'Denied'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handleRespond(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.75rem',
                backgroundColor: '#166534',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Check size={12} />
              Approve
            </button>
            <button
              onClick={() => handleRespond(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.75rem',
                backgroundColor: '#7f1d1d',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <X size={12} />
              Deny
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
