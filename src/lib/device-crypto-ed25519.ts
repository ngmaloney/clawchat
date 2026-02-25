/**
 * Device identity helpers for OpenClaw Gateway Protocol v3.
 * Uses Ed25519 (via @noble/ed25519) matching the Control UI implementation.
 */

import * as ed25519 from '@noble/ed25519'

const STORE_KEY = 'openclaw.device.identity.v1'

interface DeviceIdentity {
  deviceId: string
  publicKey: string  // base64url encoded
  privateKey: string // base64url encoded
}

function toBase64Url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function generateKeyPair(): Promise<DeviceIdentity> {
  const privateKey = ed25519.utils.randomSecretKey()
  const publicKey = await ed25519.getPublicKeyAsync(privateKey)
  const deviceId = await sha256(publicKey)
  
  return {
    deviceId,
    publicKey: toBase64Url(publicKey),
    privateKey: toBase64Url(privateKey),
  }
}

export async function getOrCreateKeyPair(): Promise<DeviceIdentity> {
  try {
    const stored = localStorage.getItem(STORE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.publicKey === 'string' &&
        typeof parsed.privateKey === 'string'
      ) {
        // Verify deviceId matches public key
        const publicKeyBytes = fromBase64Url(parsed.publicKey)
        const computedId = await sha256(publicKeyBytes)
        if (computedId === parsed.deviceId) {
          return {
            deviceId: parsed.deviceId,
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
          }
        }
      }
    }
  } catch {
    // Fall through to generate new
  }

  // Generate new keypair
  const identity = await generateKeyPair()
  const toStore = {
    version: 1,
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    createdAtMs: Date.now(),
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(toStore))
  return identity
}

export async function getDeviceId(identity: DeviceIdentity): Promise<string> {
  return identity.deviceId
}

export async function exportPublicKey(identity: DeviceIdentity): Promise<string> {
  return identity.publicKey
}

export interface SignaturePayload {
  deviceId: string
  clientId: string
  clientMode: string
  role: string
  scopes: string[]
  signedAtMs: number
  token: string | null
  nonce: string
}

function buildSignaturePayload(payload: SignaturePayload): string {
  const scopesStr = payload.scopes.join(',')
  const tokenStr = payload.token ?? ''
  return [
    'v2',
    payload.deviceId,
    payload.clientId,
    payload.clientMode,
    payload.role,
    scopesStr,
    String(payload.signedAtMs),
    tokenStr,
    payload.nonce,
  ].join('|')
}

export async function signChallenge(
  identity: DeviceIdentity,
  payload: SignaturePayload
): Promise<string> {
  const payloadStr = buildSignaturePayload(payload)
  const message = new TextEncoder().encode(payloadStr)
  const privateKeyBytes = fromBase64Url(identity.privateKey)
  const signature = await ed25519.signAsync(message, privateKeyBytes)
  return toBase64Url(signature)
}
