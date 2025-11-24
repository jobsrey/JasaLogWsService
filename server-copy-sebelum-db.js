const WebSocket = require('ws');

// Konfigurasi WebSocket Server
const WS_PORT = process.env.PORT || 8080;
const WS_HOST = process.env.HOST || '0.0.0.0';

// Storage untuk data kapal
const shipsData = new Map();

// Buat WebSocket Server
const wss = new WebSocket.Server({ 
  port: WS_PORT,
  host: WS_HOST
});

console.log('\n' + '='.repeat(70));
console.log('🌐 AIS WEBSOCKET SERVER');
console.log('='.repeat(70));
console.log(`WebSocket Server : ws://${WS_HOST}:${WS_PORT}`);
console.log(`Status           : RUNNING`);
console.log('='.repeat(70) + '\n');

// Fungsi untuk format timestamp
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

// Fungsi untuk broadcast data ke semua client
function broadcastToClients(data) {
  const message = JSON.stringify(data);
  let clientCount = 0;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.clientType === 'viewer') {
      client.send(message);
      clientCount++;
    }
  });
  
  return clientCount;
}

// Fungsi untuk extract data penting dari AIS
function extractShipData(decodedData) {
  if (!decodedData || !decodedData.mmsi) {
    return null;
  }

  const shipData = {
    mmsi: decodedData.mmsi,
    timestamp: new Date().toISOString(),
    messageType: decodedData.type || decodedData.aisType,
  };

  // Data posisi (Message Type 1, 2, 3, 18, 19)
  if (decodedData.lat !== undefined && decodedData.lon !== undefined) {
    shipData.lat = decodedData.lat;
    shipData.lon = decodedData.lon;
    shipData.speed = decodedData.speed || decodedData.sog || 0;
    shipData.course = decodedData.course || decodedData.cog || 0;
    shipData.heading = decodedData.heading || decodedData.trueHeading || 0;
    // Decoder uses 'status' not 'navStatus'
    shipData.navStatus = decodedData.status || decodedData.navStatus || decodedData.navigationStatus;
  }

  // Data statis (Message Type 5, 19, 24)
  // Decoder uses 'shipname' not 'name'
  if (decodedData.shipname) {
    shipData.name = decodedData.shipname.trim();
  } else if (decodedData.name) {
    shipData.name = decodedData.name.trim();
  }
  
  if (decodedData.callsign) {
    shipData.callsign = decodedData.callsign.trim();
  }
  
  // Decoder uses 'shiptype' not 'shipType'
  if (decodedData.shiptype !== undefined) {
    shipData.shipType = decodedData.shiptype;
  } else if (decodedData.shipType !== undefined) {
    shipData.shipType = decodedData.shipType;
  }
  
  if (decodedData.destination) {
    shipData.destination = decodedData.destination.trim();
  }
  
  // Format ETA if available
  if (decodedData.eta_month && decodedData.eta_day && decodedData.eta_hour !== undefined && decodedData.eta_minute !== undefined) {
    shipData.eta = `${String(decodedData.eta_month).padStart(2, '0')}-${String(decodedData.eta_day).padStart(2, '0')} ${String(decodedData.eta_hour).padStart(2, '0')}:${String(decodedData.eta_minute).padStart(2, '0')}`;
  } else if (decodedData.eta) {
    shipData.eta = decodedData.eta;
  }
  
  // Decoder uses 'to_bow', 'to_stern', etc not 'dimBow', 'dimStern'
  if (decodedData.to_bow !== undefined || decodedData.dimBow !== undefined) {
    shipData.dimensions = {
      bow: decodedData.to_bow || decodedData.dimBow || 0,
      stern: decodedData.to_stern || decodedData.dimStern || 0,
      port: decodedData.to_port || decodedData.dimPort || 0,
      starboard: decodedData.to_starboard || decodedData.dimStarboard || 0,
      length: (decodedData.to_bow || decodedData.dimBow || 0) + (decodedData.to_stern || decodedData.dimStern || 0),
      width: (decodedData.to_port || decodedData.dimPort || 0) + (decodedData.to_starboard || decodedData.dimStarboard || 0)
    };
  }
  
  // IMO number (from message type 5)
  if (decodedData.imo) {
    shipData.imo = decodedData.imo;
  }
  
  // Draught (from message type 5)
  if (decodedData.draught) {
    shipData.draught = decodedData.draught;
  }

  return shipData;
}

// Fungsi untuk update data kapal
function updateShipData(shipData) {
  if (!shipData || !shipData.mmsi) {
    return;
  }

  const mmsi = shipData.mmsi.toString();
  
  // Ambil data existing atau buat baru
  let existingData = shipsData.get(mmsi) || { mmsi };
  
  // Merge data baru dengan data existing
  existingData = {
    ...existingData,
    ...shipData,
    lastUpdate: new Date().toISOString()
  };
  
  // Simpan kembali
  shipsData.set(mmsi, existingData);
  
  return existingData;
}

// Handle koneksi WebSocket
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[${getTimeStamp()}] ✓ Client connected: ${clientIp}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Identifikasi tipe client
      if (data.type === 'identify') {
        ws.clientType = data.clientType; // 'sender' atau 'viewer'
        console.log(`[${getTimeStamp()}] Client identified as: ${data.clientType}`);
        
        // Jika viewer, kirim semua data kapal yang ada
        if (data.clientType === 'viewer') {
          const allShips = Array.from(shipsData.values());
          ws.send(JSON.stringify({
            type: 'initial_data',
            ships: allShips,
            count: allShips.length
          }));
          console.log(`[${getTimeStamp()}] Sent ${allShips.length} ships to viewer`);
        }
        return;
      }
      
      // Handle data AIS dari sender
      if (data.type === 'ais_data' && ws.clientType === 'sender') {
        const shipData = extractShipData(data.decoded);
        
        if (shipData) {
          const updatedShip = updateShipData(shipData);
          
          // Broadcast ke semua viewer
          const clientCount = broadcastToClients({
            type: 'ship_update',
            ship: updatedShip
          });
          
          console.log(`[${getTimeStamp()}] 📡 AIS Data: MMSI ${shipData.mmsi} | Broadcasted to ${clientCount} clients`);
          
          // Log jika ada posisi
          if (shipData.lat && shipData.lon) {
            console.log(`  Position: ${shipData.lat.toFixed(6)}, ${shipData.lon.toFixed(6)} | Speed: ${shipData.speed} knots`);
          }
        }
      }
      
      // Handle request untuk semua data kapal
      if (data.type === 'get_all_ships' && ws.clientType === 'viewer') {
        const allShips = Array.from(shipsData.values());
        ws.send(JSON.stringify({
          type: 'all_ships',
          ships: allShips,
          count: allShips.length
        }));
      }
      
    } catch (error) {
      console.error(`[${getTimeStamp()}] ❌ Error parsing message:`, error.message);
    }
  });
  
  ws.on('close', () => {
    console.log(`[${getTimeStamp()}] ⚠️  Client disconnected: ${clientIp}`);
  });
  
  ws.on('error', (error) => {
    console.error(`[${getTimeStamp()}] ❌ WebSocket error:`, error.message);
  });
});

// Cleanup data kapal yang sudah lama tidak update (10 menit = tidak aktif)
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000; // 10 menit - kapal dianggap tidak aktif
  let removedCount = 0;
  const removedShips = [];
  
  shipsData.forEach((ship, mmsi) => {
    const lastUpdate = new Date(ship.lastUpdate).getTime();
    if (now - lastUpdate > timeout) {
      removedShips.push({
        mmsi: mmsi,
        name: ship.name || 'Unknown',
        lastUpdate: ship.lastUpdate
      });
      shipsData.delete(mmsi);
      removedCount++;
    }
  });
  
  if (removedCount > 0) {
    console.log(`[${getTimeStamp()}] 🧹 Removed ${removedCount} inactive ships (no signal > 10 min)`);
    
    // Broadcast penghapusan ke semua viewer clients
    removedShips.forEach(ship => {
      console.log(`  - MMSI ${ship.mmsi} (${ship.name}) - Last seen: ${new Date(ship.lastUpdate).toLocaleTimeString('id-ID')}`);
      
      broadcastToClients({
        type: 'ship_removed',
        mmsi: ship.mmsi,
        reason: 'inactive',
        lastUpdate: ship.lastUpdate
      });
    });
  }
}, 2 * 60 * 1000); // Check setiap 2 menit untuk deteksi lebih cepat

// Statistik setiap 60 detik
setInterval(() => {
  const totalShips = shipsData.size;
  const totalClients = wss.clients.size;
  const viewers = Array.from(wss.clients).filter(c => c.clientType === 'viewer').length;
  const senders = Array.from(wss.clients).filter(c => c.clientType === 'sender').length;
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 STATISTIK SERVER`);
  console.log('='.repeat(70));
  console.log(`Total Kapal      : ${totalShips}`);
  console.log(`Total Clients    : ${totalClients} (Viewers: ${viewers}, Senders: ${senders})`);
  console.log(`Last Update      : ${getTimeStamp()}`);
  console.log('='.repeat(70) + '\n');
}, 60000);

// Handle shutdown
function shutdown() {
  console.log('\n\n' + '='.repeat(70));
  console.log('🛑 SHUTTING DOWN WEBSOCKET SERVER');
  console.log('='.repeat(70));
  console.log(`Total ships tracked: ${shipsData.size}`);
  console.log('='.repeat(70) + '\n');
  
  wss.close(() => {
    console.log('WebSocket Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('💡 WebSocket Server ready to receive AIS data');
console.log('   Waiting for connections...\n');
