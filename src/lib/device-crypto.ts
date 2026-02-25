/**
 * Device identity helpers for OpenClaw Gateway Protocol v3.
 *
 * Uses Web Crypto API (SubtleCrypto) — ECDSA P-256 keypair stored as JWK
 * in electron-store via window.api.store.
 */

const ALGORITHM: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' }
const SIGN_ALGORITHM: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' }
const STORE_KEY = 'deviceKeyPair'

interface StoredKeyPair {
  publicKey: JsonWebKey
  privateKey: JsonWebKey
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function toBase64Url(buf: ArrayBuffer): string {
  return toBase64(buf)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Load or generate a persistent ECDSA P-256 keypair.
 */
export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  const stored = await window.api.store.get(STORE_KEY) as StoredKeyPair | undefined

  if (stored?.publicKey && stored?.privateKey) {
    const [publicKey, privateKey] = await Promise.all([
      crypto.subtle.importKey('jwk', stored.publicKey, ALGORITHM, true, ['verify']),
      crypto.subtle.importKey('jwk', stored.privateKey, ALGORITHM, true, ['sign']),
    ])
    return { publicKey, privateKey }
  }

  const keyPair = await crypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify'])

  const [pubJwk, privJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
  ])

  await window.api.store.set(STORE_KEY, { publicKey: pubJwk, privateKey: privJwk })

  return keyPair
}

/**
 * Stable device ID — SHA-256 of SPKI-encoded public key, hex-encoded.
 */
export async function getDeviceId(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  const hash = await crypto.subtle.digest('SHA-256', spki)
  return toHex(hash)
}

/**
 * Export public key as base64-encoded SPKI for transmission.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  return toBase64(spki)
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
  return ['v2', payload.deviceId, payload.clientId, payload.clientMode, payload.role, scopesStr, String(payload.signedAtMs), tokenStr, payload.nonce].join('|')
}

/**
 * Sign a challenge with device auth payload per OpenClaw protocol.
 */
export async function signChallenge(privateKey: CryptoKey, payload: SignaturePayload): Promise<string> {
  const encoder = new TextEncoder()
  const payloadStr = buildSignaturePayload(payload)
  console.log('[device-crypto] Signing payload:', payloadStr)
  const data = encoder.encode(payloadStr)
  const signature = await crypto.subtle.sign(SIGN_ALGORITHM, privateKey, data)
  const sig = toBase64(signature)
  console.log('[device-crypto] Signature (base64):', sig.substring(0, 20) + '...')
  return sig
}
