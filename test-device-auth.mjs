#!/usr/bin/env node
/**
 * Test device authentication with OpenClaw gateway
 */
import { webcrypto } from 'node:crypto';
const { subtle } = webcrypto;

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' };

function toBase64(buf) {
  return Buffer.from(buf).toString('base64');
}

function toBase64Url(buf) {
  // Matches Control UI's zi() function
  return toBase64(buf).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function toHex(buf) {
  return Buffer.from(buf).toString('hex');
}

async function generateKeyPair() {
  return await subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);
}

async function getDeviceId(publicKey) {
  const spki = await subtle.exportKey('spki', publicKey);
  const hash = await subtle.digest('SHA-256', spki);
  return toHex(hash);
}

async function exportPublicKey(publicKey) {
  const spki = await subtle.exportKey('spki', publicKey);
  return toBase64Url(spki);
}

function buildSignaturePayload(payload) {
  const scopesStr = payload.scopes.join(',');
  const tokenStr = payload.token ?? '';
  return ['v2', payload.deviceId, payload.clientId, payload.clientMode, payload.role, scopesStr, String(payload.signedAtMs), tokenStr, payload.nonce].join('|');
}

async function signChallenge(privateKey, payload) {
  const encoder = new TextEncoder();
  const payloadStr = buildSignaturePayload(payload);
  console.log('Signing payload:', payloadStr);
  const data = encoder.encode(payloadStr);
  const signature = await subtle.sign(SIGN_ALGORITHM, privateKey, data);
  return toBase64Url(signature);  // Control UI uses base64url
}

// Import WebSocket
const WebSocket = (await import('ws')).default;

const token = '34443b7904a646bd1d0e6814ef348be14d6b4baf61912ceb';
const url = 'ws://localhost:18789';

console.log('🔑 Generating device keypair...');
const keyPair = await generateKeyPair();
const deviceId = await getDeviceId(keyPair.publicKey);
const publicKey = await exportPublicKey(keyPair.publicKey);

console.log('📱 Device ID:', deviceId.substring(0, 16) + '...');
console.log('🔐 Public key:', publicKey.substring(0, 20) + '...');

console.log('\n🌐 Connecting to', url);
const ws = new WebSocket(url);

let challengeNonce = null;
let challengeTs = null;

ws.on('open', () => {
  console.log('✅ Connected');
});

ws.on('message', async (data) => {
  const frame = JSON.parse(data.toString());
  
  if (frame.event === 'connect.challenge') {
    console.log('\n📥 Received challenge');
    challengeNonce = frame.payload?.nonce ?? null;
    challengeTs = Date.now();
    
    if (!challengeNonce) {
      console.error('❌ No nonce in challenge!');
      ws.close();
      return;
    }
    
    console.log('🔢 Nonce:', challengeNonce);
    
    // Use Date.now() for signedAt, NOT challengeTs!
    const signedAt = Date.now();
    const scopes = ['operator.admin', 'operator.approvals', 'operator.pairing'];
    
    console.log('\n🔏 Generating signature...');
    const signature = await signChallenge(keyPair.privateKey, {
      deviceId,
      clientId: 'cli',
      clientMode: 'cli',
      role: 'operator',
      scopes,
      signedAtMs: signedAt,
      token,
      nonce: challengeNonce,
    });
    
    console.log('📝 Signature:', signature.substring(0, 20) + '...');
    
    const handshake = {
      type: 'req',
      id: 'test-1',
      method: 'connect',
      params: {
        role: 'operator',
        scopes,
        auth: { token },
        device: {
          id: deviceId,
          publicKey,
          signature,
          signedAt,  // Current time, not challenge time!
          nonce: challengeNonce,
        },
        client: {
          id: 'cli',
          version: 'test',
          platform: 'node',
          mode: 'cli'
        },
        minProtocol: 3,
        maxProtocol: 3
      }
    };
    
    console.log('\n📤 Sending handshake...');
    ws.send(JSON.stringify(handshake));
  } else if (frame.type === 'res' && frame.id === 'test-1') {
    if (frame.ok) {
      console.log('\n✅ HANDSHAKE SUCCESS!');
      console.log('Protocol:', frame.payload.protocol);
      if (frame.payload.auth) {
        console.log('Auth scopes:', frame.payload.auth.scopes);
        console.log('Device token:', frame.payload.auth.deviceToken ? 'GRANTED' : 'none');
      } else {
        console.log('⚠️  NO AUTH IN RESPONSE');
      }
      
      // Test if we have scopes by calling sessions.list
      console.log('\n🧪 Testing operator.read scope (sessions.list)...');
      ws.send(JSON.stringify({
        type: 'req',
        id: 'test-2',
        method: 'sessions.list',
        params: {}
      }));
    } else {
      console.log('\n❌ HANDSHAKE FAILED');
      console.log('Error:', frame.error);
      ws.close();
      process.exit(1);
    }
  } else if (frame.type === 'res' && frame.id === 'test-2') {
    if (frame.ok) {
      console.log('✅ sessions.list WORKED! We have operator.read scope!');
    } else {
      console.log('❌ sessions.list FAILED:', frame.error?.message || 'unknown');
    }
    ws.close();
    process.exit(frame.ok ? 0 : 1);
  }
});

ws.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 Closed: ${code} ${reason}`);
  if (code !== 1000) process.exit(1);
});
