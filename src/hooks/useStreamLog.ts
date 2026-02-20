import { useCallback, useEffect, useRef, useState } from 'react'
import type { GatewayClient } from '../lib/gateway-client'
import type { ConnectionStatus } from '../types/protocol'

export interface StreamEntry {
  id: number
  ts: number
  event: string
  sessionKey?: string
  state?: string
  role?: string
  stopReason?: string
  tokens?: { input?: number; output?: number }
  text?: string
  contentTypes?: string[]
  raw: Record<string, unknown>
}

let _entryId = 0

function summarisePayload(_event: string, payload: Record<string, unknown>): Partial<StreamEntry> {
  const msg = payload.message as Record<string, unknown> | undefined
  const state = payload.state as string | undefined
  const result: Partial<StreamEntry> = {
    sessionKey: payload.sessionKey as string | undefined,
    state,
  }

  if (msg) {
    result.role = msg.role as string | undefined
    result.stopReason = msg.stopReason as string | undefined
    const usage = msg.usage as Record<string, unknown> | undefined
    if (usage) {
      result.tokens = {
        input: usage.inputTokens as number | undefined,
        output: usage.outputTokens as number | undefined,
      }
    }

    // For finals, keep the full text; for deltas, truncate
    const maxLen = state === 'final' ? 5000 : 300

    // Summarise content
    const content = msg.content
    if (typeof content === 'string') {
      result.text = content.length > maxLen ? content.slice(0, maxLen) + '…' : content
    } else if (Array.isArray(content)) {
      result.contentTypes = content.map((b: Record<string, unknown>) => b.type as string)
      const textBlocks = content
        .filter((b: Record<string, unknown>) => b.type === 'text')
        .map((b: Record<string, unknown>) => b.text as string)
        .join('')
      if (textBlocks) {
        result.text = textBlocks.length > maxLen ? textBlocks.slice(0, maxLen) + '…' : textBlocks
      }
    }
  }

  return result
}

export function useStreamLog(
  client: GatewayClient | null,
  status: ConnectionStatus,
): { entries: StreamEntry[]; clear: () => void } {
  const [entries, setEntries] = useState<StreamEntry[]>([])
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  const clear = useCallback(() => setEntries([]), [])

  // Subscribe to all gateway events
  useEffect(() => {
    if (!client) return

    const handler = (event: string, payload: Record<string, unknown>) => {
      const entry: StreamEntry = {
        id: ++_entryId,
        ts: Date.now(),
        event,
        ...summarisePayload(event, payload),
        raw: payload,
      }
      setEntries((prev) => {
        // Keep last 500 entries
        const next = [...prev, entry]
        return next.length > 500 ? next.slice(-500) : next
      })
    }

    // The onEvent callback on GatewayClient fires for every event
    // We need to use the .on() method for each event we care about
    // But we also want ALL events. The easiest way is to listen to
    // specific known events plus use a catch-all approach.
    const unsubs = [
      client.on('chat', (p) => handler('chat', p)),
      client.on('agent', (p) => handler('agent', p)),
      client.on('exec', (p) => handler('exec', p)),
      client.on('exec.approval.request', (p) => handler('exec', p)),
      client.on('tick', (p) => handler('tick', p)),
      client.on('health', (p) => handler('health', p)),
      client.on('presence', (p) => handler('presence', p)),
      client.on('shutdown', (p) => handler('shutdown', p)),
    ]

    return () => { unsubs.forEach((u) => u()) }
  }, [client])

  // Clear on disconnect
  useEffect(() => {
    if (status === 'disconnected') {
      setEntries([])
    }
  }, [status])

  return { entries, clear }
}
