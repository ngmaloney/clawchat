import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChat } from '../hooks/useChat'
import type { GatewayClient } from '../lib/gateway-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

type ChatEventCallback = (payload: Record<string, unknown>) => void

function makeMockClient() {
  const chatListeners = new Set<ChatEventCallback>()

  const client = {
    on: vi.fn((event: string, cb: ChatEventCallback) => {
      if (event === 'chat') chatListeners.add(cb)
      return () => chatListeners.delete(cb)
    }),
    call: vi.fn(),
    getMaxPayload: vi.fn(() => 1048576),
  } as unknown as GatewayClient

  function emitChat(payload: Record<string, unknown>) {
    chatListeners.forEach((cb) => cb(payload))
  }

  return { client, emitChat }
}

function makeFinalEvent(sessionKey = 'agent:main:main', content = 'Hello from assistant') {
  return {
    sessionKey,
    state: 'final',
    message: { role: 'assistant', content, timestamp: new Date().toISOString() },
  }
}

function makeDeltaEvent(sessionKey = 'agent:main:main', content = 'Hello') {
  return {
    sessionKey,
    state: 'delta',
    message: { role: 'assistant', content },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useChat', () => {
  let client: GatewayClient
  let emitChat: (payload: Record<string, unknown>) => void

  beforeEach(() => {
    const mock = makeMockClient()
    client = mock.client
    emitChat = mock.emitChat
  })

  // ── Bug 1: hadStreamingMessage was always false ───────────────────────────
  // React's setState updater runs async — reading the variable set inside it
  // after calling setMessages() gives the stale value, not the updated one.
  // Fix: use pendingLocalSendRef set synchronously before the async send call.

  it('does NOT reload history when a locally-sent message receives a final event', async () => {
    const historyCall = vi.fn().mockResolvedValue({ messages: [] })
    ;(client.call as ReturnType<typeof vi.fn>).mockImplementation((method: string) => {
      if (method === 'chat.history') return historyCall()
      if (method === 'chat.send') return Promise.resolve({ runId: 'run-1' })
      return Promise.resolve({})
    })

    const { result } = renderHook(() =>
      useChat(client, 'connected', 'agent:main:main')
    )

    // Wait for initial history load
    await act(async () => { await Promise.resolve() })
    const initialHistoryCalls = historyCall.mock.calls.length

    // Send a message
    await act(async () => {
      await result.current.send('Hello')
    })

    // Emit delta then final (simulating a local run completing)
    act(() => { emitChat(makeDeltaEvent()) })
    act(() => { emitChat(makeFinalEvent()) })

    await act(async () => { await Promise.resolve() })

    // History should NOT have been reloaded after the final event
    expect(historyCall.mock.calls.length).toBe(initialHistoryCalls)
  })

  // ── Bug 2: receivedDeltaRef was always true for external runs ─────────────
  // Gateway streams delta events to ALL clients for ALL runs. Using delta
  // presence to detect local runs always returned true — external runs were
  // never detected and history was never reloaded.
  // Fix: only pendingLocalSendRef (set in send()) correctly identifies local runs.

  it('DOES reload history when a final event arrives for an external run', async () => {
    const historyCall = vi.fn().mockResolvedValue({ messages: [] })
    ;(client.call as ReturnType<typeof vi.fn>).mockImplementation((method: string) => {
      if (method === 'chat.history') return historyCall()
      return Promise.resolve({})
    })

    const { result: _ } = renderHook(() =>
      useChat(client, 'connected', 'agent:main:main')
    )

    await act(async () => { await Promise.resolve() })
    const callsBefore = historyCall.mock.calls.length

    // Emit delta + final with NO preceding local send (external run)
    act(() => { emitChat(makeDeltaEvent()) })
    act(() => { emitChat(makeFinalEvent()) })

    await act(async () => { await Promise.resolve() })

    // History SHOULD have reloaded to surface the external user message
    expect(historyCall.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  // ── Bug 3: optimistic messages were wiped on every final ──────────────────
  // The history reload on local runs was replacing optimistic messages with
  // server state before the user could see them.

  it('preserves the user message after send + final without history reload', async () => {
    ;(client.call as ReturnType<typeof vi.fn>).mockImplementation((method: string) => {
      if (method === 'chat.history') return Promise.resolve({ messages: [] })
      if (method === 'chat.send') return Promise.resolve({ runId: 'run-1' })
      return Promise.resolve({})
    })

    const { result } = renderHook(() =>
      useChat(client, 'connected', 'agent:main:main')
    )

    await act(async () => { await Promise.resolve() })

    await act(async () => {
      await result.current.send('Test message')
    })

    act(() => { emitChat(makeDeltaEvent()) })
    act(() => { emitChat(makeFinalEvent(undefined, 'Response from assistant')) })

    await act(async () => { await Promise.resolve() })

    const messages = result.current.messages
    const userMsg = messages.find((m) => m.role === 'user')
    const assistantMsg = messages.find((m) => m.role === 'assistant')

    expect(userMsg).toBeDefined()
    expect(userMsg?.text).toBe('Test message')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg?.text).toBe('Response from assistant')
    expect(assistantMsg?.streaming).toBe(false)
  })

  // ── Bug 4: isStreaming never resets if final arrives before error ─────────
  it('resets isStreaming to false after final event', async () => {
    ;(client.call as ReturnType<typeof vi.fn>).mockImplementation((method: string) => {
      if (method === 'chat.history') return Promise.resolve({ messages: [] })
      if (method === 'chat.send') return Promise.resolve({ runId: 'run-1' })
      return Promise.resolve({})
    })

    const { result } = renderHook(() =>
      useChat(client, 'connected', 'agent:main:main')
    )

    await act(async () => {
      await result.current.send('Hello')
    })

    expect(result.current.isStreaming).toBe(true)

    act(() => { emitChat(makeDeltaEvent()) })
    act(() => { emitChat(makeFinalEvent()) })

    await act(async () => { await Promise.resolve() })

    expect(result.current.isStreaming).toBe(false)
  })

  // ── Sanity: events for a different session are ignored ────────────────────
  it('ignores chat events for a different session', async () => {
    ;(client.call as ReturnType<typeof vi.fn>).mockResolvedValue({ messages: [] })

    const { result } = renderHook(() =>
      useChat(client, 'connected', 'agent:main:main')
    )

    await act(async () => { await Promise.resolve() })
    const initialCount = result.current.messages.length

    act(() => {
      emitChat(makeFinalEvent('agent:other:session', 'Should not appear'))
    })

    await act(async () => { await Promise.resolve() })

    expect(result.current.messages.length).toBe(initialCount)
  })
})
