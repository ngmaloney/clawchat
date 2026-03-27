import { describe, it, expect } from 'vitest'
import { isSentinelMessage } from '../lib/sentinel'

describe('isSentinelMessage', () => {
  it('returns true for HEARTBEAT_OK', () => {
    expect(isSentinelMessage('HEARTBEAT_OK')).toBe(true)
  })

  it('returns true for NO_REPLY', () => {
    expect(isSentinelMessage('NO_REPLY')).toBe(true)
  })

  it('returns true with leading/trailing whitespace', () => {
    expect(isSentinelMessage('  HEARTBEAT_OK  ')).toBe(true)
    expect(isSentinelMessage('\nNO_REPLY\n')).toBe(true)
  })

  it('returns false for normal messages', () => {
    expect(isSentinelMessage('Hello!')).toBe(false)
    expect(isSentinelMessage('This is a real message')).toBe(false)
  })

  it('returns false for partial matches', () => {
    expect(isSentinelMessage('HEARTBEAT_OK and more text')).toBe(false)
    expect(isSentinelMessage('Prefix NO_REPLY')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(isSentinelMessage('heartbeat_ok')).toBe(false)
    expect(isSentinelMessage('no_reply')).toBe(false)
  })

  it('returns false for empty/null/undefined', () => {
    expect(isSentinelMessage('')).toBe(false)
    expect(isSentinelMessage(null)).toBe(false)
    expect(isSentinelMessage(undefined)).toBe(false)
  })
})
