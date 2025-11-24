import net from 'net';
import WebSocket from 'ws';
import macaddress from 'macaddress';

// Konfigurasi
const R400NG_CONFIG = {
  host: '192.168.2.12',
  port: 7777
};

const WEBSOCKET_SERVER = 'ws://23.31.23.35:8613';
const DEBOUNCE_DELAY = 100; // 100ms delay untuk menghindari pengiriman terlalu sering
const APP_KEY='mb764kZuB6zi7ydihoUHAxG4oONs73HX6IkKCiDNaobaWTSWIf2kbCZQQJIGl7'; //ini untuk identifikasi device online

// Buffer untuk menyimpan data AIS
let aisDataBuffer = [];
let tcpClient = null;
let wsClient = null;
let reconnectTimeout = null;
let deviceMacAddress = null;
let sendTimeout = null; // Untuk debouncing

// Fungsi untuk menghubungkan ke R400NG via TCP
function connectToR400NG() {
  console.log(`Menghubungkan ke R400NG di ${R400NG_CONFIG.host}:${R400NG_CONFIG.port}...`);
  
  tcpClient = new net.Socket();
  
  tcpClient.connect(R400NG_CONFIG.port, R400NG_CONFIG.host, () => {
    console.log('✓ Terhubung ke R400NG');
  });

  tcpClient.on('data', (data) => {
    const aisMessages = data.toString().split('\n').filter(msg => msg.trim());
    
    aisMessages.forEach(msg => {
      if (msg.startsWith('!AIVDM') || msg.startsWith('!AIVDO')) {
        aisDataBuffer.push({
          message: msg.trim(),
          timestamp: new Date().toISOString()
        });
        console.log(`Data AIS diterima: ${msg.substring(0, 50)}...`);
        
        // Kirim data segera dengan debouncing
        triggerImmediateSend();
      }
    });
  });

  tcpClient.on('error', (err) => {
    console.error('Error koneksi R400NG:', err.message);
    handleR400NGDisconnect();
  });

  tcpClient.on('close', () => {
    console.log('Koneksi R400NG terputus');
    handleR400NGDisconnect();
  });
}

// Fungsi untuk menangani disconnect R400NG
function handleR400NGDisconnect() {
  if (tcpClient) {
    tcpClient.destroy();
    tcpClient = null;
  }
  
  // Reconnect setelah 5 detik
  console.log('Mencoba reconnect ke R400NG dalam 5 detik...');
  setTimeout(connectToR400NG, 5000);
}

// Fungsi untuk menghubungkan ke WebSocket Server
function connectToWebSocket() {
  console.log(`Menghubungkan ke WebSocket Server di ${WEBSOCKET_SERVER}...`);
  
  try {
    wsClient = new WebSocket(WEBSOCKET_SERVER);

    wsClient.on('open', () => {
      console.log('✓ Terhubung ke WebSocket Server');
    });

    wsClient.on('error', (err) => {
      console.error('Error koneksi WebSocket:', err.message);
    });

    wsClient.on('close', () => {
      console.log('Koneksi WebSocket terputus');
      handleWebSocketDisconnect();
    });

    wsClient.on('message', (data) => {
      console.log('Pesan dari server:', data.toString());
    });

  } catch (err) {
    console.error('Error membuat koneksi WebSocket:', err.message);
    handleWebSocketDisconnect();
  }
}

// Fungsi untuk menangani disconnect WebSocket
function handleWebSocketDisconnect() {
  wsClient = null;
  
  // Reconnect setelah 5 detik
  console.log('Mencoba reconnect ke WebSocket Server dalam 5 detik...');
  setTimeout(connectToWebSocket, 5000);
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
    source: 'R400NG',
    sourceIP: R400NG_CONFIG.host,
    receivedAt: new Date().toISOString(),
    dataCount: aisDataBuffer.length,
    aisData: aisDataBuffer
  };

  try {
    wsClient.send(JSON.stringify(payload));
    console.log(`✓ ${aisDataBuffer.length} data AIS terkirim segera ke WebSocket Server`);
    
    // Kosongkan buffer setelah berhasil dikirim
    aisDataBuffer = [];
  } catch (err) {
    console.error('Error mengirim data:', err.message);
  }
}

// Fungsi untuk graceful shutdown
function shutdown() {
  console.log('\nMenutup koneksi...');
  
  if (tcpClient) {
    tcpClient.destroy();
  }
  
  if (wsClient) {
    wsClient.close();
  }
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  if (sendTimeout) {
    clearTimeout(sendTimeout);
  }
  
  process.exit(0);
}

// Handle CTRL+C
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Mulai aplikasi
async function startApplication() {
  console.log('=== AIS Data Forwarder ===');
  console.log(`Laptop IP: 192.168.2.33`);
  console.log(`R400NG: ${R400NG_CONFIG.host}:${R400NG_CONFIG.port}`);
  console.log(`WebSocket Server: ${WEBSOCKET_SERVER}`);
  console.log(`Mode: Pengiriman segera saat data diterima (debounce: ${DEBOUNCE_DELAY}ms)\n`);

  // Dapatkan MAC address
  deviceMacAddress = await getMacAddress();
  console.log(`Device MAC Address: ${deviceMacAddress || 'Tidak dapat dideteksi'}`);
  console.log(`APP_KEY: ${APP_KEY}\n`);

  // Koneksi ke R400NG dan WebSocket
  connectToR400NG();
  connectToWebSocket();

  console.log('Aplikasi berjalan. Data akan dikirim segera saat diterima dari R400NG.');
  console.log('Tekan CTRL+C untuk berhenti.');
}

startApplication();