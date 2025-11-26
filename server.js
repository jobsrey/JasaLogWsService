import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { MongoClient, ObjectId } from 'mongodb';


// Konfigurasi WebSocket Server
const WS_PORT = process.env.PORT_WSS || 8080;
const WS_HOST = process.env.HOST_WSS || '0.0.0.0';

// Konfigurasi Debug - Set ke false untuk disable validasi sensor (untuk debugging)
const ENABLE_DEVICE_VALIDATION = true; // Ubah ke false untuk skip validasi sensor

// Konfigurasi MongoDB
const MONGODB_URI = 'mongodb://root:ldJLy9txqwa4QS0wgua8tjssZVjHwyTMzA98LhzBIvB54k2FG45odwnMr4LXTxbX@194.233.93.64:27017/?directConnection=true';
const DB_NAME = 'app_jasalog';
const COLLECTION_NAME = 'vessel';
const SENSORS_COLLECTION_NAME = 'sensors';

// MongoDB client
let mongoClient = null;
let db = null;
let shipsCollection = null;
let sensorsCollection = null;

// Storage untuk data kapal (in-memory cache)
const shipsData = new Map();

// Fungsi untuk koneksi MongoDB
async function connectMongoDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    shipsCollection = db.collection(COLLECTION_NAME);
    sensorsCollection = db.collection(SENSORS_COLLECTION_NAME);
    
    // Buat index untuk MMSI untuk performa yang lebih baik
    await shipsCollection.createIndex({ mmsi: 1 }, { unique: true });
    
    // Buat index untuk sensors collection
    await sensorsCollection.createIndex({ id: 1, userId: 1 }, { unique: true });
    
    console.log('✓ MongoDB connected successfully');
    console.log(`  Database: ${DB_NAME}`);
    console.log(`  Collection: ${COLLECTION_NAME}`);
    console.log(`  Sensors Collection: ${SENSORS_COLLECTION_NAME}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

// Fungsi untuk validasi sensor berdasarkan app_key dan user_key dari sensors table
async function validateSensor(appKey, userKey) {
  // Jika validasi device dinonaktifkan (untuk debugging)
  if (!ENABLE_DEVICE_VALIDATION) {
    console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Sensor validation DISABLED - allowing all sensors`);
    console.log(`[${getTimeStamp()}] 🔧 Sensor info: APP_KEY=${appKey} | USER_KEY=${userKey}`);
    return { valid: true, sensorId: appKey, userId: userKey };
  }

  if (!sensorsCollection || !appKey || !userKey) {
    console.log(`[${getTimeStamp()}] ⚠️  Validasi sensor gagal: app_key atau user_key kosong`);
    return { valid: false, sensorId: null, userId: null };
  }

  try {
    const sensor = await sensorsCollection.findOne({
      _id: new ObjectId(appKey),
      userId: userKey
    });

    if (sensor) {
      console.log(`[${getTimeStamp()}] ✓ Sensor valid: APP_KEY=${appKey} | USER_KEY=${userKey}`);
      return { valid: true, sensorId: sensor.id, userId: sensor.userId };
    } else {
      console.log(`[${getTimeStamp()}] ❌ Sensor tidak ditemukan: APP_KEY=${appKey} | USER_KEY=${userKey}`);
      return { valid: false, sensorId: null, userId: null };
    }
  } catch (error) {
    console.error(`[${getTimeStamp()}] ❌ Error validasi sensor:`, error.message);
    return { valid: false, sensorId: null, userId: null };
  }
}

// Buat WebSocket Server
const wss = new WebSocketServer({ 
  port: WS_PORT,
  host: WS_HOST
});

console.log('\n' + '='.repeat(70));
console.log('🌐 AIS WEBSOCKET SERVER');
console.log('='.repeat(70));
console.log(`WebSocket Server : ws://${WS_HOST}:${WS_PORT}`);
console.log(`Status           : RUNNING`);
console.log(`Device Validation: ${ENABLE_DEVICE_VALIDATION ? '✓ ENABLED' : '🔧 DISABLED (DEBUG MODE)'}`);
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

// Fungsi untuk broadcast data ke semua client dengan filter berdasarkan clientType
function broadcastToClients(data, senderInfo = null) {
  const message = JSON.stringify(data);
  let clientCount = 0;
  
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    
    // Handle berbagai tipe viewer
    let shouldSend = false;
    
    if (client.clientType === 'viewer') {
      // Viewer standar - terima semua data
      shouldSend = true;
    } else if (client.clientType === 'viewer-by-user' && senderInfo) {
      // Viewer-by-user - hanya terima data dari user yang sama
      shouldSend = client.userKey === senderInfo.userKey;
    } else if (client.clientType === 'viewer-by-device' && senderInfo) {
      // Viewer-by-device - hanya terima data dari app_key yang diminta
      shouldSend = client.appKey === senderInfo.appKey;
    }
    
    if (shouldSend) {
      client.send(message);
      clientCount++;
    }
  });
  
  return clientCount;
}


// Fungsi untuk extract data penting dari AIS
function extractShipData(decodedData, sensorId = null) {
  if (!decodedData || !decodedData.mmsi) {
    return null;
  }

  const shipData = {
    mmsi: decodedData.mmsi,
    timestamp: new Date().toISOString(),
    messageType: decodedData.type || decodedData.aisType,
    // Add country information
    country: decodedData.country || null,
    countryCode: decodedData.countryCode || null,
    // Add sensor information
    sensorId: sensorId || null,
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

// Fungsi untuk update data kapal (in-memory cache)
async function updateShipData(shipData) {
  if (!shipData || !shipData.mmsi) {
    return null;
  }

  const mmsi = shipData.mmsi.toString();
  
  // Ambil data existing dari memory atau buat baru
  let existingData = shipsData.get(mmsi) || { mmsi };
  
  // Merge data baru dengan data existing menggunakan spread operator
  existingData = {
    ...existingData,
    ...shipData,
    lastUpdate: new Date().toISOString()
  };
  
  // Simpan ke memory cache
  shipsData.set(mmsi, existingData);
  
  return existingData;
}

// Handle koneksi WebSocket
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[${getTimeStamp()}] ✓ Client connected: ${clientIp}`);
  
  // Flag untuk tracking validasi device
  ws.isValidated = false;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // PRIORITAS 1: Handle identify message PERTAMA
      if (data.type === 'identify') {
        ws.clientType = data.clientType; // 'sender', 'viewer', 'viewer-by-user', 'viewer-by-device'
        console.log(`[${getTimeStamp()}] ✓✓✓ CLIENT IDENTIFIED AS: ${data.clientType.toUpperCase()} ✓✓✓`);
        console.log(`[${getTimeStamp()}]     App Key: ${data.app_key || 'N/A'}`);
        console.log(`[${getTimeStamp()}]     User Key: ${data.user_key || 'N/A'}`);
        console.log(`[${getTimeStamp()}]     MAC: ${data.mac_address || 'N/A'}`);
        
        // Handle viewer standar
        if (data.clientType === 'viewer') {
          ws.isValidated = true;
          const allShips = Array.from(shipsData.values());
          ws.send(JSON.stringify({
            type: 'initial_data',
            ships: allShips,
            count: allShips.length
          }));
          console.log(`[${getTimeStamp()}] Sent ${allShips.length} ships to viewer`);
        }
        
        // Handle viewer-by-user (tidak perlu validasi, hanya simpan user_key)
        if (data.clientType === 'viewer-by-user' && data.user_key) {
          ws.isValidated = true;
          ws.userKey = data.user_key;
          // Filter ships berdasarkan user_key
          const userShips = Array.from(shipsData.values()).filter(ship => ship.sensorId && ship.sensorId.startsWith(data.user_key));
          ws.send(JSON.stringify({
            type: 'initial_data',
            ships: userShips,
            count: userShips.length,
            filterType: 'viewer-by-user',
            userId: data.user_key
          }));
          console.log(`[${getTimeStamp()}] Sent ${userShips.length} ships (filtered by user) to viewer-by-user`);
        }
        
        // Handle viewer-by-device (tidak perlu validasi, hanya simpan app_key)
        if (data.clientType === 'viewer-by-device' && data.app_key) {
          ws.isValidated = true;
          ws.appKey = data.app_key;
          // Filter ships berdasarkan app_key
          const deviceShips = Array.from(shipsData.values()).filter(ship => ship.sensorId === data.app_key);
          ws.send(JSON.stringify({
            type: 'initial_data',
            ships: deviceShips,
            count: deviceShips.length,
            filterType: 'viewer-by-device',
            appKey: data.app_key
          }));
          console.log(`[${getTimeStamp()}] Sent ${deviceShips.length} ships (filtered by device) to viewer-by-device`);
        }
        
        // Handle sender - validasi sensor dengan app_key dan user_key
        if (data.clientType === 'sender' && data.app_key && data.user_key) {
          const sensorValidation = await validateSensor(data.app_key, data.user_key);
          
          if (!sensorValidation.valid) {
            if (ENABLE_DEVICE_VALIDATION) {
              console.log(`[${getTimeStamp()}] 🚫 Sensor tidak valid, disconnect: ${clientIp}`);
              ws.close(1008, 'Sensor not authorized');
              return;
            } else {
              console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Sensor validation failed but allowing connection anyway`);
            }
          }
          
          ws.isValidated = true;
          ws.sensorInfo = {
            sensorId: sensorValidation.sensorId,
            userId: sensorValidation.userId,
            app_key: data.app_key,
            user_key: data.user_key,
            mac_address: data.mac_address
          };
          
          if (ENABLE_DEVICE_VALIDATION) {
            console.log(`[${getTimeStamp()}] ✓ Sensor authorized: ${data.app_key}`);
          } else {
            console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Sensor accepted without validation: ${data.app_key}`);
          }
        }
        return;
      }
      
      // PRIORITAS 2: Validasi sensor untuk sender yang belum tervalidasi
      if (!ws.isValidated && data.app_key && data.user_key && data.type !== 'identify') {
        const sensorValidation = await validateSensor(data.app_key, data.user_key);
        
        if (!sensorValidation.valid) {
          if (ENABLE_DEVICE_VALIDATION) {
            console.log(`[${getTimeStamp()}] 🚫 Sensor tidak valid, disconnect: ${clientIp}`);
            ws.close(1008, 'Sensor not authorized');
            return;
          } else {
            console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Sensor validation failed but allowing connection anyway`);
          }
        }
        
        ws.isValidated = true;
        ws.sensorInfo = {
          sensorId: sensorValidation.sensorId,
          userId: sensorValidation.userId,
          app_key: data.app_key,
          user_key: data.user_key,
          mac_address: data.mac_address
        };
        
        if (ENABLE_DEVICE_VALIDATION) {
          console.log(`[${getTimeStamp()}] ✓ Sensor authorized: ${data.app_key}`);
        } else {
          console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Sensor accepted without validation: ${data.app_key}`);
        }
      }
      
      // PRIORITAS 3: Cek validasi untuk pesan non-identify
      if (!ws.isValidated && data.type !== 'identify') {
        if (ENABLE_DEVICE_VALIDATION) {
          console.log(`[${getTimeStamp()}] 🚫 Pesan diterima sebelum validasi sensor, disconnect: ${clientIp}`);
          ws.close(1008, 'Sensor validation required');
          return;
        } else {
          console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Accepting message without sensor validation`);
          // Set sebagai tervalidasi untuk debug mode
          ws.isValidated = true;
          ws.sensorInfo = {
            sensorId: data.app_key || 'DEBUG_MODE',
            userId: data.user_key || 'DEBUG_MODE',
            app_key: data.app_key || 'DEBUG_MODE',
            user_key: data.user_key || 'DEBUG_MODE',
            mac_address: data.mac_address || 'DEBUG_MODE'
          };
        }
      }
      
      // DEBUG: Log semua pesan yang diterima
      console.log(`[${getTimeStamp()}] 📨 Message received | Type: ${data.type || 'NO_TYPE'} | ClientType: ${ws.clientType || 'UNIDENTIFIED'} | Validated: ${ws.isValidated}`);
      
      // Handle data dari sender (AIS data dan device location)
      if (ws.clientType === 'sender' && ws.isValidated) {
        console.log(`[${getTimeStamp()}] ✓ Processing sender data...`);
        
        // Prepare sender info untuk broadcast filtering
        const senderInfo = {
          appKey: ws.sensorInfo?.app_key,
          userKey: ws.sensorInfo?.user_key,
          sensorId: ws.sensorInfo?.sensorId
        };
        
        
        // Handle AIS data jika ada
        if (data.aisData && Array.isArray(data.aisData)) {
          console.log(`[${getTimeStamp()}] 📦 Received ${data.aisData.length} AIS messages`);
          for (const aisItem of data.aisData) {
            const shipData = extractShipData(aisItem.decoded, ws.sensorInfo?.sensorId);
            
            if (shipData) {
              try {
                const updatedShip = await updateShipData(shipData);
                
                if (updatedShip) {
                  // Broadcast ke viewer dengan filter
                  const clientCount = broadcastToClients({
                    type: 'ship_update',
                    ship: updatedShip
                  }, senderInfo);
                  
                  console.log(`[${getTimeStamp()}] 📡 AIS Data: MMSI ${shipData.mmsi} | Sensor: ${ws.sensorInfo?.sensorId} | Broadcasted to ${clientCount} clients`);
                  
                  // Log country information if available
                  if (shipData.country) {
                    console.log(`  Country: ${shipData.country} (${shipData.countryCode})`);
                  }
                  
                  // Log jika ada posisi
                  if (shipData.lat && shipData.lon) {
                    console.log(`  Position: ${shipData.lat.toFixed(6)}, ${shipData.lon.toFixed(6)} | Speed: ${shipData.speed} knots`);
                  }
                }
              } catch (error) {
                console.error(`[${getTimeStamp()}] ❌ Error updating ship data:`, error.message);
              }
            }
          }
        }
      }
      
      // Handle request untuk semua data kapal
      if (data.type === 'get_all_ships' && (ws.clientType === 'viewer' || ws.clientType === 'viewer-by-user' || ws.clientType === 'viewer-by-device')) {
        let allShips = Array.from(shipsData.values());
        
        // Filter berdasarkan tipe viewer
        if (ws.clientType === 'viewer-by-user' && ws.userKey) {
          allShips = allShips.filter(ship => ship.sensorId && ship.sensorId.startsWith(ws.userKey));
        } else if (ws.clientType === 'viewer-by-device' && ws.appKey) {
          allShips = allShips.filter(ship => ship.sensorId === ws.appKey);
        }
        
        ws.send(JSON.stringify({
          type: 'all_ships',
          ships: allShips,
          count: allShips.length
        }));
      }
      
      // FALLBACK: Jika tidak ada type tapi ada aisData (untuk kompatibilitas dengan client-serial-port)
      if (!data.type && data.aisData && Array.isArray(data.aisData) && ws.clientType === 'sender' && ws.isValidated) {
        console.log(`[${getTimeStamp()}] 📦 Received ${data.aisData.length} AIS messages (no type field)`);
        
        // Prepare sender info untuk broadcast filtering
        const senderInfo = {
          appKey: ws.sensorInfo?.app_key,
          userKey: ws.sensorInfo?.user_key,
          sensorId: ws.sensorInfo?.sensorId
        };
        
        for (const aisItem of data.aisData) {
          const shipData = extractShipData(aisItem.decoded, ws.sensorInfo?.sensorId);
          
          if (shipData) {
            try {
              const updatedShip = await updateShipData(shipData);
              
              if (updatedShip) {
                // Broadcast ke viewer dengan filter
                const clientCount = broadcastToClients({
                  type: 'ship_update',
                  ship: updatedShip
                }, senderInfo);
                
                console.log(`[${getTimeStamp()}] 📡 AIS Data: MMSI ${shipData.mmsi} | Sensor: ${ws.sensorInfo?.sensorId} | Broadcasted to ${clientCount} clients`);
                
                // Log country information if available
                if (shipData.country) {
                  console.log(`  Country: ${shipData.country} (${shipData.countryCode})`);
                }
                
                // Log jika ada posisi
                if (shipData.lat && shipData.lon) {
                  console.log(`  Position: ${shipData.lat.toFixed(6)}, ${shipData.lon.toFixed(6)} | Speed: ${shipData.speed} knots`);
                }
              }
            } catch (error) {
              console.error(`[${getTimeStamp()}] ❌ Error updating ship data:`, error.message);
            }
          }
        }
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
async function shutdown() {
  console.log('\n\n' + '='.repeat(70));
  console.log('🛑 SHUTTING DOWN WEBSOCKET SERVER');
  console.log('='.repeat(70));
  console.log(`Total ships tracked: ${shipsData.size}`);
  console.log('='.repeat(70) + '\n');
  
  // Tutup koneksi MongoDB
  if (mongoClient) {
    try {
      await mongoClient.close();
      console.log('✓ MongoDB connection closed');
    } catch (error) {
      console.error('❌ Error closing MongoDB connection:', error.message);
    }
  }
  
  wss.close(() => {
    console.log('WebSocket Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Inisialisasi server
async function initializeServer() {
  try {
    // Koneksi ke MongoDB
    await connectMongoDB();
    
    console.log('💡 WebSocket Server ready to receive AIS data');
    console.log('   Waiting for connections...\n');
  } catch (error) {
    console.error('❌ Server initialization failed:', error.message);
    process.exit(1);
  }
}

// Jalankan inisialisasi
initializeServer();
