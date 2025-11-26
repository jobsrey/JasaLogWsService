import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { MongoClient } from 'mongodb';

// Konfigurasi WebSocket Server
const WS_PORT = process.env.PORT_WSS || 8080;
const WS_HOST = process.env.HOST_WSS || '0.0.0.0';

// Konfigurasi Debug - Set ke false untuk disable validasi device (untuk debugging)
const ENABLE_DEVICE_VALIDATION = false; // Ubah ke false untuk skip validasi device

// Konfigurasi MongoDB
const MONGODB_URI = 'mongodb://root:ldJLy9txqwa4QS0wgua8tjssZVjHwyTMzA98LhzBIvB54k2FG45odwnMr4LXTxbX@vo8ggww8ks0w484so8ow0swk:27017/?directConnection=true';
const DB_NAME = 'app_jasalog';
const COLLECTION_NAME = 'vessel';
const DEVICE_COLLECTION_NAME = 'device';
const DEVICE_LOCATION_COLLECTION_NAME = 'device_location';

// MongoDB client
let mongoClient = null;
let db = null;
let shipsCollection = null;
let deviceCollection = null;
let deviceLocationCollection = null;

// Storage untuk data kapal (in-memory cache)
const shipsData = new Map();

// Storage untuk data lokasi device (in-memory cache)
const deviceLocations = new Map();

// Fungsi untuk koneksi MongoDB
async function connectMongoDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    shipsCollection = db.collection(COLLECTION_NAME);
    deviceCollection = db.collection(DEVICE_COLLECTION_NAME);
    deviceLocationCollection = db.collection(DEVICE_LOCATION_COLLECTION_NAME);
    
    // Buat index untuk MMSI untuk performa yang lebih baik
    await shipsCollection.createIndex({ mmsi: 1 }, { unique: true });
    
    // Buat index untuk device collection
    await deviceCollection.createIndex({ app_key: 1, mac_address: 1 }, { unique: true });
    
    // Buat index untuk device location collection
    await deviceLocationCollection.createIndex({ app_key: 1, mac_address: 1 }, { unique: true });
    
    console.log('✓ MongoDB connected successfully');
    console.log(`  Database: ${DB_NAME}`);
    console.log(`  Collection: ${COLLECTION_NAME}`);
    console.log(`  Device Collection: ${DEVICE_COLLECTION_NAME}`);
    console.log(`  Device Location Collection: ${DEVICE_LOCATION_COLLECTION_NAME}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

// Fungsi untuk validasi device berdasarkan app_key dan mac_address
async function validateDevice(appKey, macAddress) {
  // Jika validasi device dinonaktifkan (untuk debugging)
  if (!ENABLE_DEVICE_VALIDATION) {
    console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Device validation DISABLED - allowing all devices`);
    console.log(`[${getTimeStamp()}] 🔧 Device info: ${appKey} | MAC: ${macAddress || 'N/A'}`);
    return true;
  }

  if (!deviceCollection || !appKey || !macAddress) {
    console.log(`[${getTimeStamp()}] ⚠️  Validasi device gagal: app_key atau mac_address kosong`);
    return false;
  }

  try {
    const device = await deviceCollection.findOne({
      app_key: appKey,
      mac_address: macAddress
    });

    if (device) {
      console.log(`[${getTimeStamp()}] ✓ Device valid: ${appKey} | MAC: ${macAddress}`);
      return true;
    } else {
      console.log(`[${getTimeStamp()}] ❌ Device tidak ditemukan: ${appKey} | MAC: ${macAddress}`);
      return false;
    }
  } catch (error) {
    console.error(`[${getTimeStamp()}] ❌ Error validasi device:`, error.message);
    return false;
  }
}

// Fungsi untuk upsert data kapal ke MongoDB
async function upsertShipToMongoDB(shipData) {
  if (!shipsCollection || !shipData || !shipData.mmsi) {
    return null;
  }

  try {
    const filter = { mmsi: shipData.mmsi };
    const update = {
      $set: {
        ...shipData,
        lastUpdate: new Date().toISOString()
      }
    };
    
    const options = {
      upsert: true,
      returnDocument: 'after'
    };
    
    const result = await shipsCollection.findOneAndUpdate(filter, update, options);
    
    if (result.lastErrorObject?.upserted) {
      console.log(`  📝 MongoDB: Inserted new ship MMSI ${shipData.mmsi}`);
    } else {
      console.log(`  🔄 MongoDB: Updated existing ship MMSI ${shipData.mmsi}`);
    }
    
    return result.value;
  } catch (error) {
    console.error(`❌ MongoDB upsert error for MMSI ${shipData.mmsi}:`, error.message);
    return null;
  }
}

// Fungsi untuk upsert device location ke MongoDB
async function upsertDeviceLocationToMongoDB(deviceLocationData) {
  if (!deviceLocationCollection || !deviceLocationData || !deviceLocationData.app_key || !deviceLocationData.mac_address) {
    return null;
  }

  try {
    const filter = { 
      app_key: deviceLocationData.app_key,
      mac_address: deviceLocationData.mac_address
    };
    const update = {
      $set: {
        ...deviceLocationData,
        lastUpdate: new Date().toISOString()
      }
    };
    
    const options = {
      upsert: true,
      returnDocument: 'after'
    };
    
    const result = await deviceLocationCollection.findOneAndUpdate(filter, update, options);
    
    if (result.lastErrorObject?.upserted) {
      console.log(`  📍 MongoDB: Inserted new device location ${deviceLocationData.name} (${deviceLocationData.app_key})`);
    } else {
      console.log(`  🔄 MongoDB: Updated device location ${deviceLocationData.name} (${deviceLocationData.app_key})`);
    }
    
    return result.value;
  } catch (error) {
    console.error(`❌ MongoDB device location upsert error for ${deviceLocationData.app_key}:`, error.message);
    return null;
  }
}

// Fungsi untuk update device location (in-memory dan MongoDB)
async function updateDeviceLocation(deviceLocationData) {
  if (!deviceLocationData || !deviceLocationData.app_key || !deviceLocationData.mac_address) {
    return null;
  }

  const deviceKey = `${deviceLocationData.app_key}_${deviceLocationData.mac_address}`;
  
  // Merge data baru dengan data existing
  const existingData = deviceLocations.get(deviceKey) || {};
  const updatedData = {
    ...existingData,
    ...deviceLocationData,
    lastUpdate: new Date().toISOString()
  };
  
  // Simpan ke memory cache
  deviceLocations.set(deviceKey, updatedData);
  
  // Simpan ke MongoDB (upsert)
  const mongoResult = await upsertDeviceLocationToMongoDB(updatedData);
  
  return updatedData;
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

// Fungsi untuk broadcast device location ke semua client
function broadcastDeviceLocationToClients(deviceLocation) {
  const message = JSON.stringify({
    type: 'device_location_update',
    device: deviceLocation
  });
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
    // Add country information
    country: decodedData.country || null,
    countryCode: decodedData.countryCode || null,
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

// Fungsi untuk update data kapal (in-memory dan MongoDB)
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
  
  // Simpan ke MongoDB (upsert)
  const mongoResult = await upsertShipToMongoDB(existingData);
  
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
      
      // Validasi device pada pesan pertama (app_key dan mac_address)
      if (!ws.isValidated && data.app_key && data.mac_address) {
        const isValid = await validateDevice(data.app_key, data.mac_address);
        
        if (!isValid) {
          if (ENABLE_DEVICE_VALIDATION) {
            console.log(`[${getTimeStamp()}] 🚫 Device tidak valid, disconnect: ${clientIp}`);
            ws.close(1008, 'Device not authorized');
            return;
          } else {
            console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Device validation failed but allowing connection anyway`);
          }
        }
        
        ws.isValidated = true;
        ws.deviceInfo = {
          app_key: data.app_key,
          mac_address: data.mac_address
        };
        
        if (ENABLE_DEVICE_VALIDATION) {
          console.log(`[${getTimeStamp()}] ✓ Device authorized: ${data.app_key}`);
        } else {
          console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Device accepted without validation: ${data.app_key}`);
        }
      }
      
      // Jika belum tervalidasi dan bukan pesan pertama, disconnect (kecuali debug mode)
      if (!ws.isValidated && data.type !== 'identify') {
        if (ENABLE_DEVICE_VALIDATION) {
          console.log(`[${getTimeStamp()}] 🚫 Pesan diterima sebelum validasi device, disconnect: ${clientIp}`);
          ws.close(1008, 'Device validation required');
          return;
        } else {
          console.log(`[${getTimeStamp()}] 🔧 DEBUG MODE: Accepting message without device validation`);
          // Set sebagai tervalidasi untuk debug mode
          ws.isValidated = true;
          ws.deviceInfo = {
            app_key: data.app_key || 'DEBUG_MODE',
            mac_address: data.mac_address || 'DEBUG_MODE'
          };
        }
      }
      
      // Identifikasi tipe client
      if (data.type === 'identify') {
        ws.clientType = data.clientType; // 'sender' atau 'viewer'
        console.log(`[${getTimeStamp()}] Client identified as: ${data.clientType}`);
        
        // Jika viewer, kirim semua data kapal dan device locations yang ada
        if (data.clientType === 'viewer') {
          const allShips = Array.from(shipsData.values());
          const allDeviceLocations = Array.from(deviceLocations.values());
          ws.send(JSON.stringify({
            type: 'initial_data',
            ships: allShips,
            devices: allDeviceLocations,
            count: allShips.length,
            deviceCount: allDeviceLocations.length
          }));
          console.log(`[${getTimeStamp()}] Sent ${allShips.length} ships and ${allDeviceLocations.length} devices to viewer`);
        }
        return;
      }
      
      // Handle data dari sender (AIS data dan device location)
      if (ws.clientType === 'sender' && ws.isValidated) {
        // Handle device location jika ada
        if (data.deviceLocation) {
          try {
            const deviceLocationData = {
              app_key: data.app_key,
              mac_address: data.mac_address,
              latitude: data.deviceLocation.latitude,
              longitude: data.deviceLocation.longitude,
              name: data.deviceLocation.name,
              description: data.deviceLocation.description,
              source: data.source,
              sourcePort: data.sourcePort
            };
            
            const updatedDeviceLocation = await updateDeviceLocation(deviceLocationData);
            
            if (updatedDeviceLocation) {
              // Broadcast device location ke semua viewer
              const clientCount = broadcastDeviceLocationToClients(updatedDeviceLocation);
              console.log(`[${getTimeStamp()}] 📍 Device Location: ${updatedDeviceLocation.name} | Broadcasted to ${clientCount} clients`);
              console.log(`  Location: ${updatedDeviceLocation.latitude.toFixed(6)}, ${updatedDeviceLocation.longitude.toFixed(6)}`);
            }
          } catch (error) {
            console.error(`[${getTimeStamp()}] ❌ Error updating device location:`, error.message);
          }
        }
        
        // Handle AIS data jika ada
        if (data.aisData && Array.isArray(data.aisData)) {
          for (const aisItem of data.aisData) {
            const shipData = extractShipData(aisItem.decoded);
            
            if (shipData) {
              try {
                const updatedShip = await updateShipData(shipData);
                
                if (updatedShip) {
                  // Broadcast ke semua viewer
                  const clientCount = broadcastToClients({
                    type: 'ship_update',
                    ship: updatedShip
                  });
                  
                  console.log(`[${getTimeStamp()}] 📡 AIS Data: MMSI ${shipData.mmsi} | Broadcasted to ${clientCount} clients`);
                  
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
