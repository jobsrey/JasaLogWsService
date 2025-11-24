import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import AISDecoder from './lib/AisDecoder/index.js';
import WebSocket from 'ws';
import macaddress from 'macaddress';

// Konfigurasi R400NG Serial USB
const R400NG_CONFIG = {
  path: 'COM3', // Ubah sesuai port COM R400NG Anda (cek di Device Manager)
  baudRate: 38400, // Baud rate standar untuk R400NG
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
};

// Konfigurasi WebSocket
const WEBSOCKET_SERVER = 'ws://23.31.23.35:8613';
const DEBOUNCE_DELAY = 100; // 100ms delay untuk menghindari pengiriman terlalu sering
const APP_KEY = 'mb764kZuB6zi7ydihoUHAxG4oONs73HX6IkKCiDNaobaWTSWIf2kbCZQQJIGl7'; // ini untuk identifikasi device online

// Buffer untuk menyimpan data AIS
let aisDataBuffer = [];
let serialPort = null;
let parser = null;
let messageCount = 0;
let startTime = Date.now();
let lastMessageTime = null;
const aisDecoder = new AISDecoder();
let wsClient = null;
let wsConnected = false;
let wsSentCount = 0;
let deviceMacAddress = null;
let sendTimeout = null; // Untuk debouncing

// Fungsi untuk format waktu
function getTimeStamp() {
  const now = new Date();
  return now.toLocaleTimeString('id-ID', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

// Fungsi untuk menghitung delay
function getDelay() {
  if (!lastMessageTime) return 'First message';
  const delay = Date.now() - lastMessageTime;
  return `${delay}ms`;
}

// Fungsi untuk mendecode tipe message AIS (basic)
function getAISMessageType(message) {
  const parts = message.split(',');
  if (parts.length >= 6) {
    const payload = parts[5];
    if (payload && payload.length > 0) {
      const firstChar = payload.charCodeAt(0);
      const messageType = firstChar - 48;
      if (messageType > 40) {
        return (firstChar - 56);
      }
      return messageType;
    }
  }
  return 'Unknown';
}

// Fungsi untuk mendapatkan deskripsi message type
function getMessageTypeDescription(type) {
  const types = {
    1: 'Position Report (Class A)',
    2: 'Position Report (Class A)',
    3: 'Position Report (Class A)',
    4: 'Base Station Report',
    5: 'Static and Voyage Data',
    18: 'Position Report (Class B)',
    19: 'Extended Position Report (Class B)',
    21: 'Aid-to-Navigation Report',
    24: 'Static Data Report'
  };
  return types[type] || `Type ${type}`;
}

// Fungsi untuk statistik
function showStats() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const messagesPerMinute = uptime > 0 ? (messageCount / (uptime / 60)).toFixed(2) : 0;
  const messagesPerSecond = uptime > 0 ? (messageCount / uptime).toFixed(2) : 0;
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 STATISTIK REALTIME`);
  console.log('='.repeat(70));
  console.log(`Total Pesan      : ${messageCount}`);
  console.log(`Sent to WS       : ${wsSentCount}`);
  console.log(`WS Status        : ${wsConnected ? '✓ Connected' : '✗ Disconnected'}`);
  console.log(`Uptime           : ${uptime} detik`);
  console.log(`Rate             : ${messagesPerMinute} pesan/menit`);
  console.log(`Average          : ${messagesPerSecond} pesan/detik`);
  console.log(`Last Update      : ${getTimeStamp()}`);
  console.log('='.repeat(70) + '\n');
}

// Fungsi untuk koneksi ke WebSocket Server
function connectWebSocket() {
  console.log(`[${getTimeStamp()}] Connecting to WebSocket Server: ${WEBSOCKET_SERVER}`);
  
  wsClient = new WebSocket(WEBSOCKET_SERVER);
  
  wsClient.on('open', () => {
    wsConnected = true;
    console.log(`[${getTimeStamp()}] ✓ WebSocket connected!`);
  });
  
  wsClient.on('close', () => {
    wsConnected = false;
    console.log(`[${getTimeStamp()}] ⚠️  WebSocket disconnected. Reconnecting in 5s...`);
    handleWebSocketDisconnect();
  });
  
  wsClient.on('error', (error) => {
    wsConnected = false;
    console.error(`[${getTimeStamp()}] ❌ WebSocket error: ${error.message}`);
  });
}

// Fungsi untuk menangani disconnect WebSocket
function handleWebSocketDisconnect() {
  wsClient = null;
  wsConnected = false;
  
  // Reconnect setelah 5 detik
  console.log(`[${getTimeStamp()}] Mencoba reconnect ke WebSocket Server dalam 5 detik...`);
  setTimeout(connectWebSocket, 5000);
}

// Fungsi untuk mendapatkan MAC address
async function getMacAddress() {
  try {
    const mac = await macaddress.one();
    return mac;
  } catch (err) {
    console.error('Error mendapatkan MAC address:', err.message);
    return null;
  }
}

// Fungsi untuk trigger pengiriman data dengan debouncing
function triggerImmediateSend() {
  // Clear timeout sebelumnya jika ada
  if (sendTimeout) {
    clearTimeout(sendTimeout);
  }
  
  // Set timeout baru untuk debouncing
  sendTimeout = setTimeout(() => {
    sendDataToWebSocket();
    sendTimeout = null;
  }, DEBOUNCE_DELAY);
}

// Fungsi untuk mengirim data ke WebSocket Server
function sendDataToWebSocket() {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
    console.log('WebSocket belum siap, skip pengiriman data');
    return;
  }

  if (aisDataBuffer.length === 0) {
    console.log('Tidak ada data AIS untuk dikirim');
    return;
  }

  const payload = {
    app_key: APP_KEY,
    mac_address: deviceMacAddress,
    source: 'R400NG_Serial',
    sourcePort: R400NG_CONFIG.path,
    receivedAt: new Date().toISOString(),
    dataCount: aisDataBuffer.length,
    aisData: aisDataBuffer
  };

  try {
    wsClient.send(JSON.stringify(payload));
    console.log(`✓ ${aisDataBuffer.length} data AIS terkirim segera ke WebSocket Server`);
    wsSentCount += aisDataBuffer.length;
    
    // Kosongkan buffer setelah berhasil dikirim
    aisDataBuffer = [];
  } catch (err) {
    console.error('Error mengirim data:', err.message);
  }
}

// Fungsi untuk kirim data ke WebSocket (legacy - untuk kompatibilitas)
function sendToWebSocket(decodedData, rawMessage) {
  // Add to buffer instead of sending immediately
  aisDataBuffer.push({
    message: rawMessage,
    timestamp: new Date().toISOString(),
    decoded: decodedData
  });
  
  // Trigger immediate send with debouncing
  triggerImmediateSend();
  
  return wsClient && wsClient.readyState === WebSocket.OPEN;
}

// Fungsi untuk menghubungkan ke R400NG via Serial USB
function connectToR400NG() {
  console.log('\n' + '='.repeat(70));
  console.log('🚢 AIS DATA MONITOR - REALTIME MODE (SERIAL USB)');
  console.log('='.repeat(70));
  console.log(`R400NG Port   : ${R400NG_CONFIG.path}`);
  console.log(`Baud Rate     : ${R400NG_CONFIG.baudRate}`);
  console.log(`Mode          : REALTIME (Instant Display)`);
  console.log('='.repeat(70));
  console.log(`\n[${getTimeStamp()}] Menghubungkan ke R400NG via Serial USB...`);
  
  // Buat koneksi serial port
  serialPort = new SerialPort({
    path: R400NG_CONFIG.path,
    baudRate: R400NG_CONFIG.baudRate,
    dataBits: R400NG_CONFIG.dataBits,
    stopBits: R400NG_CONFIG.stopBits,
    parity: R400NG_CONFIG.parity,
    autoOpen: false
  });
  
  // Parser untuk membaca data per baris
  parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
  
  // Event: Port terbuka
  serialPort.on('open', () => {
    console.log(`[${getTimeStamp()}] ✓ Koneksi Serial USB berhasil! Stream REALTIME aktif...\n`);
    console.log('─'.repeat(70));
    startTime = Date.now();
  });

  // Event: Data diterima (REALTIME)
  parser.on('data', (line) => {
    const now = Date.now();
    const msg = line.trim();
    
    if (!msg) return;
    
    // Filter hanya message AIS
    if (msg.startsWith('!AIVDM') || msg.startsWith('!AIVDO')) {
      messageCount++;
      const delay = getDelay();
      lastMessageTime = now;
      
      const msgType = getAISMessageType(msg);
      const msgDesc = getMessageTypeDescription(msgType);
      
      // Decode AIS message
      const decodedData = aisDecoder.decode(msg);
      
      // Kirim ke WebSocket
      const sent = sendToWebSocket(decodedData, msg);
      
      // Format output REALTIME dengan timestamp presisi tinggi
      console.log(`[${getTimeStamp()}] 📡 Pesan #${messageCount} | Delay: ${delay} | WS: ${sent ? '✓' : '✗'}`);
      console.log(`  Type: ${msgDesc}`);
      console.log(`  Data: ${msg}`);
      console.log(`  Decoded:`, JSON.stringify(decodedData, null, 2));
      console.log('─'.repeat(70));
        
    } else if (msg.length > 0) {
      // Tampilkan data non-AIS juga REALTIME
      console.log(`[${getTimeStamp()}] 📋 Data lain: ${msg}`);
      console.log('─'.repeat(70));
    }
  });

  // Event: Error
  serialPort.on('error', (err) => {
    console.error(`\n[${getTimeStamp()}] ❌ Error: ${err.message}`);
    if (err.message.includes('cannot open')) {
      console.error(`\n💡 Tips: Pastikan:`);
      console.error(`   1. R400NG terhubung ke USB`);
      console.error(`   2. Port COM benar (cek di Device Manager)`);
      console.error(`   3. Tidak ada aplikasi lain yang menggunakan port ini`);
    }
    handleDisconnect();
  });

  // Event: Port tertutup
  serialPort.on('close', () => {
    console.log(`\n[${getTimeStamp()}] ⚠️  Koneksi Serial USB terputus`);
    handleDisconnect();
  });
  
  // Buka koneksi
  serialPort.open((err) => {
    if (err) {
      console.error(`\n[${getTimeStamp()}] ❌ Gagal membuka port: ${err.message}`);
      handleDisconnect();
    }
  });
}

// Fungsi untuk menangani disconnect
function handleDisconnect() {
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  serialPort = null;
  parser = null;
  
  console.log(`[${getTimeStamp()}] 🔄 Mencoba reconnect dalam 5 detik...\n`);
  setTimeout(connectToR400NG, 5000);
}

// Fungsi untuk shutdown
function shutdown() {
  console.log('\n\n' + '='.repeat(70));
  console.log('🛑 MENUTUP APLIKASI');
  console.log('='.repeat(70));
  
  showStats();
  
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }
  
  if (wsClient) {
    wsClient.close();
  }
  
  if (sendTimeout) {
    clearTimeout(sendTimeout);
  }
  
  console.log('Terima kasih!\n');
  process.exit(0);
}

// Handle CTRL+C
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Tampilkan stats setiap 30 detik untuk monitoring realtime
setInterval(() => {
  if (messageCount > 0) {
    showStats();
  }
}, 30000);

// Mulai aplikasi
async function startApplication() {
  console.log('=== AIS Data Forwarder (Serial USB) ===');
  console.log(`Serial Port: ${R400NG_CONFIG.path}`);
  console.log(`Baud Rate: ${R400NG_CONFIG.baudRate}`);
  console.log(`WebSocket Server: ${WEBSOCKET_SERVER}`);
  console.log(`Mode: Pengiriman segera saat data diterima (debounce: ${DEBOUNCE_DELAY}ms)\n`);

  // Dapatkan MAC address
  deviceMacAddress = await getMacAddress();
  console.log(`Device MAC Address: ${deviceMacAddress || 'Tidak dapat dideteksi'}`);
  console.log(`APP_KEY: ${APP_KEY}\n`);

  // Koneksi ke WebSocket dan Serial Port
  connectWebSocket();
  connectToR400NG();

  console.log('Aplikasi berjalan. Data akan dikirim segera saat diterima dari Serial Port.');
  console.log('Tekan CTRL+C untuk berhenti.');
}

startApplication();