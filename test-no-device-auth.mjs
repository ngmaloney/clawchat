import WebSocket from 'ws';

const token = '34443b7904a646bd1d0e6814ef348be14d6b4baf61912ceb';
const ws = new WebSocket('ws://localhost:18789');

ws.on('message', async (data) => {
  const frame = JSON.parse(data);
  
  if (frame.event === 'connect.challenge') {
    ws.send(JSON.stringify({
      type: 'req',
      id: 'test-1',
      method: 'connect',
      params: {
        role: 'operator',
        scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
        auth: { token },
        client: { id: 'cli', version: 'test', platform: 'node', mode: 'cli' },
        minProtocol: 3,
        maxProtocol: 3
      }
    }));
  } else if (frame.type === 'res' && frame.id === 'test-1') {
    console.log('Handshake response:', JSON.stringify(frame, null, 2));
    
    // Try sessions.list
    ws.send(JSON.stringify({
      type: 'req',
      id: 'test-2',
      method: 'sessions.list',
      params: {}
    }));
  } else if (frame.type === 'res' && frame.id === 'test-2') {
    console.log('\nsessions.list result:', frame.ok ? 'SUCCESS' : 'FAILED: ' + frame.error?.message);
    ws.close();
  }
});
