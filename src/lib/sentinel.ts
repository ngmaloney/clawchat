/**
 * Agent sentinel messages — internal protocol signals that should not
 * be rendered as chat bubbles.  Matching is exact (trimmed, case-sensitive).
 *
 * Filtering happens at the rendering layer so raw data is preserved in
 * history and caches.
 */

const SENTINEL_MESSAGES: ReadonlySet<string> = new Set([
  'HEARTBEAT_OK',
  'NO_REPLY',
])

/**
 * Returns true if the message text is a known sentinel that should be
 * hidden from the chat UI.
 */
export function isSentinelMessage(text: string | undefined | null): boolean {
  if (!text) return false
  return SENTINEL_MESSAGES.has(text.trim())
}
