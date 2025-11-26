# Implementation Notes - Multi-Viewer & Sensor Validation

## Overview
Implementasi fitur multi-viewer dengan validasi sensor berdasarkan APP_KEY dan USER_KEY dari tabel `sensors`.

## Perubahan yang Dilakukan

### 1. Client-Serial-Port.js
**File**: `client-serial-port.js`

#### Perubahan:
- Tambahkan `user_key` ke identify message (line 122)
- USER_KEY sudah didefinisikan di line 20

```javascript
// Identify message sekarang mengirim:
{
  type: 'identify',
  clientType: 'sender',
  app_key: APP_KEY,
  user_key: USER_KEY,  // ← BARU
  mac_address: deviceMacAddress
}
```

---

### 2. Server.js - Perubahan Struktur

#### A. MongoDB Collections (Line 18, 26)
```javascript
const SENSORS_COLLECTION_NAME = 'sensors';
let sensorsCollection = null;
```

#### B. Fungsi Validasi Sensor (Line 102-133)
**Fungsi baru**: `validateSensor(appKey, userKey)`
- Validasi sensor berdasarkan `id` (APP_KEY) dan `userId` (USER_KEY)
- Query: `sensors.findOne({ id: appKey, userId: userKey })`
- Return: `{ valid: boolean, sensorId: string, userId: string }`
- Respects `ENABLE_DEVICE_VALIDATION` flag

#### C. Broadcast Functions (Line 259-322)
**Update**: `broadcastToClients()` dan `broadcastDeviceLocationToClients()`
- Tambahkan parameter `senderInfo` untuk filtering
- Support 3 tipe viewer:
  - `viewer`: Terima semua data
  - `viewer-by-user`: Filter berdasarkan `userKey`
  - `viewer-by-device`: Filter berdasarkan `appKey`

```javascript
function broadcastToClients(data, senderInfo = null) {
  // Logic:
  // - viewer: send all
  // - viewer-by-user: send if client.userKey === senderInfo.userKey
  // - viewer-by-device: send if client.appKey === senderInfo.appKey
}
```

#### D. Extract Ship Data (Line 325-339)
**Update**: `extractShipData(decodedData, sensorId = null)`
- Tambahkan parameter `sensorId`
- Simpan `sensorId` di ship data
- `sensorId` akan disimpan ke MongoDB

#### E. Message Handler (Line 442-730)
**Major update**: Identifikasi dan handle 4 tipe client

**1. Identify Message Handler (Line 447-536)**
- `viewer`: Standar viewer, terima semua data
- `viewer-by-user`: Filter data berdasarkan USER_KEY
  - Simpan `ws.userKey = data.user_key`
  - Filter initial ships berdasarkan sensorId yang dimulai dengan user_key
- `viewer-by-device`: Filter data berdasarkan APP_KEY
  - Simpan `ws.appKey = data.app_key`
  - Filter initial ships berdasarkan sensorId === app_key
- `sender`: Validasi sensor dengan `validateSensor(app_key, user_key)`
  - Simpan `ws.sensorInfo` dengan sensorId, userId, app_key, user_key, mac_address

**2. Sensor Validation (Line 539-567)**
- Validasi sensor jika belum tervalidasi dan ada app_key + user_key
- Set `ws.sensorInfo` jika valid

**3. AIS Data Processing (Line 592-664)**
- Extract sensorId dari `ws.sensorInfo?.sensorId`
- Pass sensorId ke `extractShipData()`
- Broadcast dengan `senderInfo` untuk filtering

**4. Get All Ships (Line 668-683)**
- Support 3 tipe viewer dengan filtering
- `viewer-by-user`: Filter ships dengan sensorId.startsWith(userKey)
- `viewer-by-device`: Filter ships dengan sensorId === appKey

---

## Database Schema

### Sensors Collection
```javascript
{
  _id: ObjectId,
  id: String,           // APP_KEY (unique per user)
  userId: String,       // USER_KEY
  name: String,
  description: String,
  // ... other fields
}
```

**Index**: `{ id: 1, userId: 1 }` (unique)

### Vessel Collection
```javascript
{
  _id: ObjectId,
  mmsi: Number,
  sensorId: String,     // ← BARU: Reference ke sensors.id
  timestamp: String,
  messageType: Number,
  country: String,
  countryCode: String,
  lat: Number,
  lon: Number,
  speed: Number,
  course: Number,
  heading: Number,
  navStatus: String,
  name: String,
  callsign: String,
  shipType: Number,
  destination: String,
  eta: String,
  dimensions: Object,
  imo: String,
  draught: Number,
  lastUpdate: String
}
```

---

## Client Types & Behavior

### 1. Sender
```javascript
// Identify Message
{
  type: 'identify',
  clientType: 'sender',
  app_key: '69271d6712014205800cda63',
  user_key: '6927168212014205800cda5f',
  mac_address: 'XX:XX:XX:XX:XX:XX'
}

// Validasi: sensors.findOne({ id: app_key, userId: user_key })
// Jika valid: sensorId disimpan dan digunakan untuk semua data AIS
// Jika invalid & ENABLE_DEVICE_VALIDATION=true: disconnect
// Jika invalid & ENABLE_DEVICE_VALIDATION=false: allow dengan debug mode
```

### 2. Viewer (Standar)
```javascript
// Identify Message
{
  type: 'identify',
  clientType: 'viewer'
}

// Behavior: Terima semua data AIS dari semua sender
// Tidak perlu validasi
// Initial data: Semua ships dan devices
```

### 3. Viewer-by-User
```javascript
// Identify Message
{
  type: 'identify',
  clientType: 'viewer-by-user',
  user_key: '6927168212014205800cda5f'
}

// Behavior: Terima hanya data dari sender dengan user_key yang sama
// Tidak perlu validasi
// Initial data: Ships dengan sensorId.startsWith(user_key)
// Broadcast filter: client.userKey === senderInfo.userKey
```

### 4. Viewer-by-Device
```javascript
// Identify Message
{
  type: 'identify',
  clientType: 'viewer-by-device',
  app_key: '69271d6712014205800cda63'
}

// Behavior: Terima hanya data dari sender dengan app_key yang sama
// Tidak perlu validasi
// Initial data: Ships dengan sensorId === app_key
// Broadcast filter: client.appKey === senderInfo.appKey
```

---

## Configuration

### ENABLE_DEVICE_VALIDATION (Line 10)
```javascript
const ENABLE_DEVICE_VALIDATION = false; // Set ke true untuk enable validasi
```

- **false** (DEBUG MODE): Semua client diterima tanpa validasi
- **true** (PRODUCTION): Validasi sensor dari tabel sensors

---

## Flow Diagram

```
Client Connect
    ↓
Send Identify Message
    ↓
┌─────────────────────────────────────────────────────┐
│ Identify Handler (Line 447-536)                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ IF clientType === 'viewer'                          │
│   → Set isValidated = true                          │
│   → Send all ships & devices                        │
│                                                     │
│ IF clientType === 'viewer-by-user'                  │
│   → Set isValidated = true                          │
│   → Save userKey                                    │
│   → Send filtered ships (by user)                   │
│                                                     │
│ IF clientType === 'viewer-by-device'                │
│   → Set isValidated = true                          │
│   → Save appKey                                     │
│   → Send filtered ships (by device)                 │
│                                                     │
│ IF clientType === 'sender'                          │
│   → Validate sensor (app_key + user_key)            │
│   → IF valid: Save sensorInfo, set isValidated      │
│   → IF invalid & ENABLE_DEVICE_VALIDATION:          │
│      → Disconnect                                   │
│   → ELSE: Allow (debug mode)                        │
│                                                     │
└─────────────────────────────────────────────────────┘
    ↓
Ready to Process Messages
    ↓
┌─────────────────────────────────────────────────────┐
│ Message Handler (Line 539-730)                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ IF sender & isValidated:                            │
│   → Extract sensorId from sensorInfo                │
│   → Process AIS data                                │
│   → Broadcast dengan senderInfo (untuk filter)      │
│                                                     │
│ IF viewer* & get_all_ships:                         │
│   → Filter ships berdasarkan tipe viewer            │
│   → Send filtered ships                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Logging

### Identify Message
```
✓✓✓ CLIENT IDENTIFIED AS: SENDER ✓✓✓
    App Key: 69271d6712014205800cda63
    User Key: 6927168212014205800cda5f
    MAC: XX:XX:XX:XX:XX:XX
```

### Sensor Validation
```
✓ Sensor valid: APP_KEY=69271d6712014205800cda63 | USER_KEY=6927168212014205800cda5f
```

### AIS Data Broadcast
```
📡 AIS Data: MMSI 123456789 | Sensor: 69271d6712014205800cda63 | Broadcasted to 2 clients
```

---

## Testing Checklist

- [ ] Sender dapat connect dengan app_key + user_key
- [ ] Sender data disimpan dengan sensorId
- [ ] Viewer standar menerima semua data
- [ ] Viewer-by-user hanya menerima data dari user yang sama
- [ ] Viewer-by-device hanya menerima data dari device yang sama
- [ ] Validasi sensor bekerja dengan ENABLE_DEVICE_VALIDATION=true
- [ ] Debug mode bekerja dengan ENABLE_DEVICE_VALIDATION=false
- [ ] MongoDB menyimpan sensorId di vessel collection

---

## Notes

1. **sensorId** = APP_KEY dari sender
2. **userKey** = USER_KEY dari sender
3. **Broadcast filtering** dilakukan di memory (tidak ke database)
4. **Initial data** di-filter berdasarkan sensorId saat identify
5. **Viewer-by-user** filter menggunakan `sensorId.startsWith(userKey)` untuk flexibility
6. **Viewer-by-device** filter menggunakan exact match `sensorId === appKey`
