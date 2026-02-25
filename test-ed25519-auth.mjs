#!/usr/bin/env node
import * as ed25519 from '@noble/ed25519';
import { webcrypto } from 'node:crypto';
import WebSocket from 'ws';

const token = '34443b7904a646bd1d0e6814ef348be14d6b4baf61912ceb';
const url = 'ws://localhost:18789';

function toBase64Url(buf) {
  return Buffer.from(buf).toString('base64url');
}

async function sha256(data) {
  const hash = await webcrypto.subtle.digest('SHA-256', data);
  return Buffer.from(hash).toString('hex');
}

console.log('🔑 Generating Ed25519 keypair...');
const privateKey = ed25519.utils.randomSecretKey();
const publicKey = await ed25519.getPublicKeyAsync(privateKey);
const deviceId = await sha256(publicKey);

console.log('📱 Device ID:', deviceId.substring(0, 16) + '...');
console.log('🔐 Public key (b64url):', toBase64Url(publicKey).substring(0, 20) + '...');

console.log('\n🌐 Connecting to', url);
const ws = new WebSocket(url);

let challengeNonce = null;

ws.on('message', async (data) => {
  const frame = JSON.parse(data.toString());
  
  if (frame.event === 'connect.challenge') {
    console.log('\n📥 Received challenge');
    challengeNonce = frame.payload?.nonce ?? null;
    
    if (!challengeNonce) {
      console.error('❌ No nonce in challenge!');
      ws.close();
      return;
    }
    
    console.log('🔢 Nonce:', challengeNonce);
    
    const signedAt = Date.now();
    const scopes = ['operator.admin', 'operator.approvals', 'operator.pairing'];
    
    // Build v2 payload
    const payload = [
      'v2',
      deviceId,
      'cli',
      'cli',
      'operator',
      scopes.join(','),
      String(signedAt),
      token,
      challengeNonce,
    ].join('|');
    
    console.log('\n🔏 Signing payload...');
    
    const message = new TextEncoder().encode(payload);
    const signature = await ed25519.signAsync(message, privateKey);
    const signatureB64 = toBase64Url(signature);
    
    console.log('📝 Signature:', signatureB64.substring(0, 20) + '...');
    
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
          publicKey: toBase64Url(publicKey),
          signature: signatureB64,
          signedAt,
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
      
      // Test sessions.list
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
      console.log('✅ sessions.list WORKED! We have operator scopes!');
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
