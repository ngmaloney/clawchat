// Gateway WebSocket protocol types (Protocol v3)

// ── Frame types ──────────────────────────────────────────────

export interface RequestFrame {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

export interface ResponseFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: Record<string, unknown>
  error?: { code?: string; message: string }
}

export interface EventFrame {
  type: 'event'
  event: string
  payload: Record<string, unknown>
}

export type Frame = RequestFrame | ResponseFrame | EventFrame

// ── Handshake ────────────────────────────────────────────────

export interface ConnectChallengePayload {
  nonce: string
  ts: number
}

export interface DeviceIdentity {
  id: string
  publicKey: string
  signature: string
  signedAt: number
  nonce: string
}

export interface ConnectParams {
  role: 'operator'
  scopes: string[]
  auth: { token: string; deviceToken?: string }
  device?: DeviceIdentity
  client: {
    id: string
    version: string
    platform: string
    mode: string
  }
  minProtocol: number
  maxProtocol: number
}

export interface HelloOkPayload {
  type: 'hello-ok'
  protocol: number
  sessionId?: string
  auth?: { deviceToken?: string }
  [key: string]: unknown
}

// ── Chat messages ────────────────────────────────────────────

export interface ContentBlock {
  type: 'text'
  text: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
  timestamp?: string | number
  stopReason?: string
  usage?: { inputTokens?: number; outputTokens?: number }
  attachments?: ChatAttachment[]
}

// ── Chat methods ─────────────────────────────────────────────

export interface ChatAttachment {
  type: string
  mimeType: string
  fileName: string
  content: string
  size?: number
}

export interface ChatSendParams {
  sessionKey: string
  message: string
  idempotencyKey: string
  thinking?: string
  attachments?: ChatAttachment[]
}

export interface ChatSendAck {
  runId: string
  status: string
}

export interface ChatHistoryParams {
  sessionKey: string
  limit?: number
}

export interface ChatHistoryResponse {
  sessionKey: string
  sessionId: string
  messages: ChatMessage[]
  thinkingLevel?: string
}

export interface ChatAbortParams {
  sessionKey: string
}

export interface ChatAbortResponse {
  ok: boolean
  aborted: boolean
  runIds?: string[]
}

// ── Chat events ──────────────────────────────────────────────

export interface ChatDeltaPayload {
  runId: string
  sessionKey: string
  seq: number
  state: 'delta'
  message: ChatMessage
}

export interface ChatFinalPayload {
  runId: string
  sessionKey: string
  seq: number
  state: 'final'
  message: ChatMessage
}

export interface ChatErrorPayload {
  runId: string
  sessionKey: string
  seq: number
  state: 'error'
  errorMessage: string
}

export type ChatEventPayload = ChatDeltaPayload | ChatFinalPayload | ChatErrorPayload

// ── Sessions ─────────────────────────────────────────────────

export interface SessionInfo {
  key: string
  label?: string
  channel?: string
  model?: string
  totalTokens?: number
  contextTokens?: number
  inputTokens?: number
  outputTokens?: number
  [key: string]: unknown
}

export interface SessionsListResponse {
  sessions: SessionInfo[]
}

// ── Connection states ────────────────────────────────────────

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'handshaking'
  | 'connected'
  | 'error'
