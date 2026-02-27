import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react'
import { SlashCommandMenu, type SlashCommand } from './SlashCommandMenu'
import { AttachmentPreview } from './AttachmentPreview'
import type { FileAttachment } from '../lib/file-utils'
import { fileToBase64 } from '../lib/file-utils'
import type { ChatAttachment } from '../types/protocol'

interface MessageInputProps {
  onSend: (text: string, attachments?: ChatAttachment[]) => void
  onAbort: () => void
  isStreaming: boolean
  disabled: boolean
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', description: 'Show available commands' },
  { command: '/model', description: 'Show or switch model' },
  { command: '/model list', description: 'List available models' },
  { command: '/model status', description: 'Show model status' },
  { command: '/models', description: 'List model providers' },
  { command: '/new', description: 'Start a new session' },
  { command: '/stop', description: 'Stop current generation' },
  { command: '/status', description: 'Show session status' },
  { command: '/thinking', description: 'Toggle thinking mode' },
  { command: '/thinking off', description: 'Disable thinking' },
  { command: '/thinking low', description: 'Low thinking' },
  { command: '/thinking medium', description: 'Medium thinking' },
  { command: '/thinking high', description: 'High thinking' },
  { command: '/verbose', description: 'Toggle verbose output' },
  { command: '/compact', description: 'Compact session' },
  { command: '/reset', description: 'Reset session' },
]

const MAX_TOTAL_SIZE = 5 * 1024 * 1024 // 5MB

export function MessageInput({ onSend, onAbort, isStreaming, disabled }: MessageInputProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)

  const filteredCommands = useMemo(
    () => text.startsWith('/')
      ? SLASH_COMMANDS.filter(cmd => cmd.command.toLowerCase().startsWith(text.toLowerCase()))
      : [],
    [text]
  )

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return

    // Convert attachments to ChatAttachment format
    const chatAttachments: ChatAttachment[] | undefined = attachments.length > 0
      ? attachments.map(att => ({
          type: att.mimeType.startsWith('image/') ? 'image' : 'file',
          mimeType: att.mimeType,
          fileName: att.name,
          content: att.base64,
          size: att.size,
        }))
      : undefined

    onSend(trimmed, chatAttachments)
    setText('')
    setAttachments([])
    setShowSlashMenu(false)
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, disabled, onSend, attachments])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash command menu navigation
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashSelectedIndex((prev) => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashMenu(false)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (!e.shiftKey) {
          e.preventDefault()
          const selected = filteredCommands[slashSelectedIndex]
          if (selected) {
            setText(selected.command)
            setShowSlashMenu(false)
            setSlashSelectedIndex(0)
          }
          return
        }
      }
    }

    // Normal Enter behavior
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [showSlashMenu, filteredCommands, slashSelectedIndex, handleSend])

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  const handleTextChange = useCallback((value: string) => {
    setText(value)
    
    // Show slash menu if text starts with /
    if (value.startsWith('/') && !showSlashMenu) {
      setShowSlashMenu(true)
      setSlashSelectedIndex(0)
    } else if (!value.startsWith('/') && showSlashMenu) {
      setShowSlashMenu(false)
    }
  }, [showSlashMenu])

  const handleSlashSelect = useCallback((command: string) => {
    setText(command)
    setShowSlashMenu(false)
    setSlashSelectedIndex(0)
    textareaRef.current?.focus()
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    const newAttachments: FileAttachment[] = []
    
    for (const file of files) {
      try {
        const attachment = await fileToBase64(file)
        newAttachments.push(attachment)
      } catch {
        // skip files that fail to convert
      }
    }

    setAttachments(prev => {
      const updated = [...prev, ...newAttachments]
      const totalSize = updated.reduce((sum, a) => sum + a.size, 0)
      
      if (totalSize > MAX_TOTAL_SIZE) {
        alert('Total attachment size exceeds 5MB limit')
        return prev
      }
      
      return updated
    })
  }, [])

  const handleAttachClick = useCallback(async () => {
    try {
      const paths = await window.api.dialog.openFile()
      if (paths && paths.length > 0) {
        const filePromises = paths.map(path => window.api.file.read(path))
        const fileData = await Promise.all(filePromises)
        setAttachments(prev => {
          const updated = [...prev, ...fileData]
          const totalSize = updated.reduce((sum, a) => sum + a.size, 0)
          
          if (totalSize > MAX_TOTAL_SIZE) {
            alert('Total attachment size exceeds 5MB limit')
            return prev
          }
          
          return updated
        })
      }
    } catch {
      // file dialog cancelled or failed
    }
  }, [])

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await addFiles(files)
    }
  }, [addFiles])

  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items)
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (files.length > 0) {
      e.preventDefault()
      await addFiles(files)
    }
  }, [addFiles])

  return (
    <div
      style={{
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />
      )}

      {/* Slash Command Menu */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <SlashCommandMenu
          commands={filteredCommands}
          selectedIndex={slashSelectedIndex}
          onSelect={handleSlashSelect}
          position={{
            top: 60,
            left: 16,
          }}
        />
      )}

      <div
        ref={inputContainerRef}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderTop: '1px solid #2a2a4a',
          backgroundColor: isDragging ? '#2a2a4a' : '#16213e',
          transition: 'background-color 0.2s',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Attach button */}
        <button
          onClick={handleAttachClick}
          disabled={disabled}
          title="Attach files (or drag & drop, or paste images)"
          style={{
            padding: '0.625rem',
            backgroundColor: '#1a1a2e',
            color: '#e0e0e0',
            border: '1px solid #2a2a4a',
            borderRadius: '8px',
            fontSize: '1.25rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            lineHeight: 1,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          📎
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          placeholder={disabled ? 'Disconnected…' : 'Type a message… (Enter to send, Shift+Enter for newline, / for commands)'}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            padding: '0.625rem 0.75rem',
            backgroundColor: '#1a1a2e',
            border: '1px solid #2a2a4a',
            borderRadius: '8px',
            color: '#e0e0e0',
            fontSize: '0.875rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            maxHeight: '200px',
            overflow: 'auto',
            boxSizing: 'border-box',
          }}
        />

        {isStreaming ? (
          <button
            onClick={onAbort}
            title="Stop generation"
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              lineHeight: 1.5,
            }}
          >
            ■ Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            title={isStreaming ? "Send message (will queue)" : "Send message"}
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: (!text.trim() || disabled) ? '#333' : '#e85d04',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: (!text.trim() || disabled) ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              lineHeight: 1.5,
            }}
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
