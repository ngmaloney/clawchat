import { formatFileSize, isImageFile } from '../lib/file-utils'

export interface MessageAttachmentData {
  type: string
  mimeType: string
  fileName: string
  content: string
  size?: number
}

interface MessageAttachmentProps {
  attachment: MessageAttachmentData
}

export function MessageAttachment({ attachment }: MessageAttachmentProps) {
  const isImage = isImageFile(attachment.mimeType)
  
  // Clean base64 content (remove any whitespace)
  const cleanContent = attachment.content.replace(/\s/g, '')
  
  // Calculate approximate size from base64 (base64 is ~4/3 of original size)
  const estimatedSize = (cleanContent.length * 3) / 4
  const MAX_DATA_URI_SIZE = 500 * 1024 // 500KB limit for data URIs

  if (isImage) {
    // Check if data URI is too large to display
    if (estimatedSize > MAX_DATA_URI_SIZE) {
      return (
        <div style={{
          marginTop: '0.5rem',
          marginBottom: '0.25rem',
          padding: '0.75rem',
          backgroundColor: 'rgba(255, 165, 0, 0.1)',
          border: '1px solid rgba(255, 165, 0, 0.3)',
          borderRadius: '6px',
        }}>
          <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            🖼️ {attachment.fileName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#ffa500' }}>
            Image too large to display inline ({formatFileSize(estimatedSize)})
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.25rem' }}>
            Data URI size limit: {formatFileSize(MAX_DATA_URI_SIZE)}
          </div>
        </div>
      )
    }
    
    // Only create data URL for images under the size limit
    const dataUrl = `data:${attachment.mimeType};base64,${cleanContent}`
    
    // Normal image rendering for smaller images
    return (
      <div style={{
        marginTop: '0.5rem',
        marginBottom: '0.25rem',
      }}>
        <img
          src={dataUrl}
          alt={attachment.fileName}
          style={{
            maxWidth: '100%',
            maxHeight: '300px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
          onClick={() => {
            try {
              // Open in new window - may fail with very large data URIs
              const win = window.open('', '_blank')
              if (win) {
                win.document.write(`<!DOCTYPE html><html><head><title>${attachment.fileName}</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;"><img src="${dataUrl}" style="max-width:100%; height:auto;" /></body></html>`)
                win.document.close()
              }
            } catch (err) {
              alert('Image too large to open in new window')
            }
          }}
          onError={(e) => {
            // Show broken image icon or placeholder
            e.currentTarget.style.display = 'none'
          }}
        />
        <div style={{
          fontSize: '0.7rem',
          color: '#888',
          marginTop: '0.25rem',
        }}>
          {attachment.fileName}
          {attachment.size && ` (${formatFileSize(attachment.size)})`}
        </div>
      </div>
    )
  }

  // Non-image attachment
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginTop: '0.5rem',
      padding: '0.5rem',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '6px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      <div style={{
        fontSize: '1.5rem',
      }}>
        📎
      </div>
      <div style={{
        flex: 1,
        minWidth: 0,
      }}>
        <div style={{
          fontSize: '0.8rem',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {attachment.fileName}
        </div>
        {attachment.size && (
          <div style={{
            fontSize: '0.7rem',
            color: '#888',
          }}>
            {formatFileSize(attachment.size)}
          </div>
        )}
      </div>
    </div>
  )
}
