#!/usr/bin/env node
/**
 * Test script to verify ClawChat can connect and has proper scopes
 * Usage: node test-connection.js ws://localhost:18789 YOUR_TOKEN
 */

const WebSocket = require('ws');

const [,, url, token] = process.argv;

if (!url || !token) {
  console.error('Usage: node test-connection.js <gateway-url> <token>');
  process.exit(1);
}

let nextId = 1;
const getId = () => `test-${nextId++}`;

const pending = new Map();

const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);

ws.on('open', () => {
  console.log('✅ WebSocket connected');
});

ws.on('message', (data) => {
  const frame = JSON.parse(data.toString());
  
  if (frame.type === 'event' && frame.event === 'connect.challenge') {
    console.log('✅ Received connect.challenge');
    doHandshake();
  } else if (frame.type === 'res') {
    const req = pending.get(frame.id);
    if (!req) return;
    
    pending.delete(frame.id);
    clearTimeout(req.timer);
    
    if (frame.ok) {
      req.resolve(frame.payload);
    } else {
      req.reject(new Error(frame.error?.message || 'Unknown error'));
    }
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.error(`❌ WebSocket closed: code=${code} reason=${reason}`);
  process.exit(1);
});

function send(method, params) {
  const id = getId();
  const frame = { type: 'req', id, method, params };
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Request ${method} timed out`));
    }, 30000);
    
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify(frame));
  });
}

async function doHandshake() {
  try {
    const params = {
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      auth: { token },
      client: {
        id: 'openclaw-control-ui',
        version: 'test',
        platform: 'node',
        mode: 'webchat',
      },
      minProtocol: 3,
      maxProtocol: 3,
    };
    
    console.log('→ Sending connect handshake...');
    const response = await send('connect', params);
    
    if (response.type === 'hello-ok') {
      console.log('✅ Handshake successful');
      console.log('   Protocol:', response.protocol);
      if (response.auth) {
        console.log('   Scopes granted:', response.auth.scopes);
      }
      
      // Test a read scope
      console.log('\n→ Testing operator.read (sessions.list)...');
      try {
        await send('sessions.list', {});
        console.log('✅ operator.read works');
      } catch (err) {
        console.error('❌ operator.read failed:', err.message);
        process.exit(1);
      }
      
      console.log('\n✅ ALL TESTS PASSED');
      process.exit(0);
    } else {
      console.error('❌ Unexpected handshake response:', response);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Handshake failed:', err.message);
    process.exit(1);
  }
}
