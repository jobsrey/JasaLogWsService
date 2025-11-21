const WebSocket = require('ws');

// Test connection ke WebSocket server
const WS_URL = process.env.WS_URL || 'ws://localhost:8080';

console.log('🧪 Testing WebSocket Connection...');
console.log(`Connecting to: ${WS_URL}`);

const ws = new WebSocket(WS_URL);

ws.on('open', function open() {
  console.log('✅ Connected to WebSocket server!');
  
  // Identify sebagai viewer
  ws.send(JSON.stringify({
    type: 'identify',
    clientType: 'viewer'
  }));
  
  console.log('📤 Sent identification message');
});

ws.on('message', function message(data) {
  const parsed = JSON.parse(data.toString());
  console.log('📥 Received message:', parsed.type);
  
  if (parsed.type === 'initial_data') {
    console.log(`📊 Initial data: ${parsed.count} ships`);
  }
});

ws.on('close', function close() {
  console.log('❌ Connection closed');
});

ws.on('error', function error(err) {
  console.error('🚨 Connection error:', err.message);
});

// Auto close after 5 seconds
setTimeout(() => {
  console.log('⏰ Closing test connection...');
  ws.close();
  process.exit(0);
}, 5000);
