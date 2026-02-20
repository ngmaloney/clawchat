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

/**
 * Sign a challenge nonce with ECDSA-SHA256, return base64 signature.
 */
export async function signChallenge(privateKey: CryptoKey, nonce: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(nonce)
  const signature = await crypto.subtle.sign(SIGN_ALGORITHM, privateKey, data)
  return toBase64(signature)
}
