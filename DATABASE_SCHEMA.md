# Database Schema - Multi-Viewer Implementation

## MongoDB Database: `app_jasalog`

---

## Collection 1: `sensors`

### Purpose
Menyimpan informasi sensor/device yang authorized untuk mengirim AIS data.

### Schema
```javascript
{
  _id: ObjectId,
  id: String,              // APP_KEY (unique per user)
  userId: String,          // USER_KEY
  name: String,            // Nama sensor
  description: String,     // Deskripsi
  status: String,          // 'active' | 'inactive'
  createdAt: Date,
  updatedAt: Date,
  // ... other fields
}
```

### Indexes
```javascript
// Unique index untuk validasi
db.sensors.createIndex({ id: 1, userId: 1 }, { unique: true })
```

### Example Data
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  id: "69271d6712014205800cda63",
  userId: "6927168212014205800cda5f",
  name: "R400NG Receiver 1",
  description: "AIS Receiver at Port",
  status: "active",
  createdAt: ISODate("2025-11-26T10:00:00.000Z"),
  updatedAt: ISODate("2025-11-26T10:46:00.000Z")
}
```

### Query Examples
```javascript
// Find sensor by app_key dan user_key
db.sensors.findOne({
  id: "69271d6712014205800cda63",
  userId: "6927168212014205800cda5f"
})

// Find all sensors for a user
db.sensors.find({
  userId: "6927168212014205800cda5f"
})

// Find all active sensors
db.sensors.find({
  status: "active"
})
```

---

## Collection 2: `vessel`

### Purpose
Menyimpan data kapal/ship yang diterima dari AIS.

### Schema
```javascript
{
  _id: ObjectId,
  mmsi: Number,                    // Unique identifier untuk kapal
  sensorId: String,                // Reference ke sensors.id (APP_KEY)
  timestamp: String,               // ISO timestamp saat data diterima
  messageType: Number,             // AIS message type (1-24)
  
  // Country Information
  country: String,                 // Country name
  countryCode: String,             // ISO country code
  
  // Position Data (dari message type 1,2,3,18,19)
  lat: Number,                     // Latitude
  lon: Number,                     // Longitude
  speed: Number,                   // Speed over ground (knots)
  course: Number,                  // Course over ground (degrees)
  heading: Number,                 // True heading (degrees)
  navStatus: String,               // Navigation status
  
  // Static Data (dari message type 5,19,24)
  name: String,                    // Ship name
  callsign: String,                // Call sign
  shipType: Number,                // Ship type code
  destination: String,             // Destination
  eta: String,                     // Estimated time of arrival
  imo: String,                     // IMO number
  draught: Number,                 // Draught
  
  // Dimensions
  dimensions: {
    bow: Number,
    stern: Number,
    port: Number,
    starboard: Number,
    length: Number,
    width: Number
  },
  
  lastUpdate: String               // ISO timestamp saat update terakhir
}
```

### Indexes
```javascript
// Unique index untuk MMSI
db.vessel.createIndex({ mmsi: 1 }, { unique: true })

// Index untuk sensorId (untuk filtering viewer-by-device)
db.vessel.createIndex({ sensorId: 1 })

// Index untuk lastUpdate (untuk cleanup)
db.vessel.createIndex({ lastUpdate: 1 })
```

### Example Data
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  mmsi: 123456789,
  sensorId: "69271d6712014205800cda63",
  timestamp: ISODate("2025-11-26T10:46:00.000Z"),
  messageType: 1,
  country: "Indonesia",
  countryCode: "ID",
  lat: -6.123456,
  lon: 106.789012,
  speed: 12.5,
  course: 180,
  heading: 180,
  navStatus: 0,
  name: "SHIP NAME",
  callsign: "CALLSIGN",
  shipType: 70,
  destination: "DESTINATION PORT",
  eta: "11-26 12:30",
  imo: "1234567",
  draught: 8.5,
  dimensions: {
    bow: 100,
    stern: 50,
    port: 25,
    starboard: 25,
    length: 150,
    width: 50
  },
  lastUpdate: ISODate("2025-11-26T10:46:00.000Z")
}
```

### Query Examples
```javascript
// Find ship by MMSI
db.vessel.findOne({ mmsi: 123456789 })

// Find all ships from specific sensor
db.vessel.find({ sensorId: "69271d6712014205800cda63" })

// Find ships from specific user (via sensorId prefix)
db.vessel.find({ sensorId: { $regex: "^6927168212014205800cda5f" } })

// Find ships in specific area
db.vessel.find({
  lat: { $gte: -7, $lte: -5 },
  lon: { $gte: 105, $lte: 107 }
})

// Find recently updated ships (last 5 minutes)
db.vessel.find({
  lastUpdate: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
})

// Find ships by country
db.vessel.find({ countryCode: "ID" })

// Find ships by ship type
db.vessel.find({ shipType: 70 })

// Count ships per sensor
db.vessel.aggregate([
  { $group: { _id: "$sensorId", count: { $sum: 1 } } }
])

// Count ships per user
db.vessel.aggregate([
  { $group: { _id: { $substr: ["$sensorId", 0, 24] }, count: { $sum: 1 } } }
])
```

---

## Collection 3: `device`

### Purpose
Menyimpan informasi device/sensor yang terhubung.

### Schema
```javascript
{
  _id: ObjectId,
  app_key: String,                 // APP_KEY
  mac_address: String,             // MAC address device
  name: String,                    // Device name
  description: String,             // Device description
  status: String,                  // 'online' | 'offline'
  lastSeen: Date,                  // Last connection time
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
```javascript
// Unique index
db.device.createIndex({ app_key: 1, mac_address: 1 }, { unique: true })
```

### Example Data
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439013"),
  app_key: "69271d6712014205800cda63",
  mac_address: "AA:BB:CC:DD:EE:FF",
  name: "R400NG Receiver 1",
  description: "AIS Receiver at Port",
  status: "online",
  lastSeen: ISODate("2025-11-26T10:46:00.000Z"),
  createdAt: ISODate("2025-11-26T10:00:00.000Z"),
  updatedAt: ISODate("2025-11-26T10:46:00.000Z")
}
```

---

## Collection 4: `device_location`

### Purpose
Menyimpan lokasi device/sensor.

### Schema
```javascript
{
  _id: ObjectId,
  app_key: String,                 // APP_KEY
  mac_address: String,             // MAC address device
  latitude: Number,                // Device latitude
  longitude: Number,               // Device longitude
  name: String,                    // Location name
  description: String,             // Location description
  source: String,                  // Data source
  sourcePort: String,              // Source port
  lastUpdate: Date
}
```

### Indexes
```javascript
// Unique index
db.device_location.createIndex({ app_key: 1, mac_address: 1 }, { unique: true })
```

### Example Data
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439014"),
  app_key: "69271d6712014205800cda63",
  mac_address: "AA:BB:CC:DD:EE:FF",
  latitude: -6.123456,
  longitude: 106.789012,
  name: "Port Location",
  description: "R400NG Receiver at Port",
  source: "R400NG_Serial",
  sourcePort: "COM3",
  lastUpdate: ISODate("2025-11-26T10:46:00.000Z")
}
```

---

## Data Relationships

```
sensors (id, userId)
    ↓
    └─→ vessel (sensorId)
    └─→ device (app_key)
    └─→ device_location (app_key)
```

### Example Flow
1. **Sender** mengirim data dengan `app_key` dan `user_key`
2. **Server** validasi: `sensors.findOne({ id: app_key, userId: user_key })`
3. **Server** simpan data ke `vessel` dengan `sensorId = app_key`
4. **Viewer-by-user** query: `vessel.find({ sensorId: { $regex: "^user_key" } })`
5. **Viewer-by-device** query: `vessel.find({ sensorId: app_key })`

---

## Aggregation Examples

### 1. Ships per User
```javascript
db.vessel.aggregate([
  {
    $group: {
      _id: { $substr: ["$sensorId", 0, 24] },
      count: { $sum: 1 },
      sensors: { $addToSet: "$sensorId" }
    }
  },
  { $sort: { count: -1 } }
])
```

### 2. Ships per Country
```javascript
db.vessel.aggregate([
  {
    $group: {
      _id: "$countryCode",
      count: { $sum: 1 },
      country: { $first: "$country" }
    }
  },
  { $sort: { count: -1 } }
])
```

### 3. Latest Ships per Sensor
```javascript
db.vessel.aggregate([
  {
    $sort: { lastUpdate: -1 }
  },
  {
    $group: {
      _id: "$sensorId",
      latestShip: { $first: "$$ROOT" },
      totalShips: { $sum: 1 }
    }
  }
])
```

### 4. Active Ships (last 10 minutes)
```javascript
db.vessel.aggregate([
  {
    $match: {
      lastUpdate: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
    }
  },
  {
    $group: {
      _id: "$sensorId",
      count: { $sum: 1 }
    }
  }
])
```

---

## Backup & Maintenance

### Backup Commands
```bash
# Backup specific database
mongodump --uri="mongodb://root:password@host:27017/app_jasalog" --out=/backup

# Backup specific collection
mongodump --uri="mongodb://root:password@host:27017/app_jasalog" --collection=vessel --out=/backup
```

### Cleanup Commands
```javascript
// Remove inactive ships (older than 10 minutes)
db.vessel.deleteMany({
  lastUpdate: { $lt: new Date(Date.now() - 10 * 60 * 1000) }
})

// Remove offline devices
db.device.deleteMany({
  status: "offline",
  lastSeen: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
})
```

---

## Migration from Old Schema

Jika ada data lama tanpa `sensorId`, bisa di-migrate dengan:

```javascript
// Add sensorId ke existing vessels
db.vessel.updateMany(
  { sensorId: { $exists: false } },
  { $set: { sensorId: null } }
)

// Atau jika ada mapping app_key:
db.vessel.updateMany(
  { sensorId: { $exists: false }, app_key: { $exists: true } },
  [
    { $set: { sensorId: "$app_key" } }
  ]
)
```

---

## Performance Tuning

### Index Analysis
```javascript
// Check index usage
db.vessel.aggregate([{ $indexStats: {} }])

// Check query performance
db.vessel.find({ sensorId: "69271d6712014205800cda63" }).explain("executionStats")
```

### Optimization Tips
1. **Add compound index** untuk queries yang sering digunakan
2. **Use projection** untuk mengurangi data yang di-transfer
3. **Implement pagination** untuk large result sets
4. **Archive old data** ke collection terpisah
5. **Monitor slow queries** dengan profiler

---

## Security Considerations

1. **Unique Index** pada sensors mencegah duplicate entries
2. **Validation** di application layer sebelum insert
3. **Encryption** untuk sensitive data (jika diperlukan)
4. **Access Control** via MongoDB roles
5. **Audit Logging** untuk semua perubahan (optional)

---

## Monitoring Queries

```javascript
// Total ships in system
db.vessel.countDocuments()

// Total sensors
db.sensors.countDocuments()

// Active sensors (dengan recent data)
db.vessel.aggregate([
  { $group: { _id: "$sensorId" } },
  { $count: "activeSensors" }
])

// Storage usage
db.vessel.stats()
db.sensors.stats()
```
