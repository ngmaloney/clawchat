import { createConsola } from 'consola'

/**
 * Shared logger for ClawChat.
 *
 * Levels used:
 *   logger.debug  — verbose trace info, dev-only
 *   logger.info   — notable lifecycle events
 *   logger.warn   — unexpected but recoverable situations
 *   logger.error  — failures that need attention
 *
 * In production builds (import.meta.env.PROD) the threshold is set to
 * warn+error only. In dev all levels are visible.
 */
export const logger = createConsola({
  level: import.meta.env.DEV ? 5 : 1,
}).withTag('clawchat')
