# Changes Summary - Multi-Viewer & Sensor Validation

## 📋 Quick Overview

Implementasi fitur multi-viewer dengan validasi sensor dari tabel `sensors` berdasarkan APP_KEY dan USER_KEY.

---

## 🔧 Files Modified

### 1. **client-serial-port.js**
- **Line 122**: Tambahkan `user_key: USER_KEY` ke identify message
- **Impact**: Sender sekarang mengirim user_key untuk validasi sensor

### 2. **server.js**
- **Line 18**: Tambahkan `SENSORS_COLLECTION_NAME = 'sensors'`
- **Line 26**: Tambahkan `let sensorsCollection = null`
- **Line 43**: Initialize sensorsCollection di connectMongoDB()
- **Line 55**: Buat index untuk sensors collection
- **Line 102-133**: Tambahkan fungsi `validateSensor(appKey, userKey)`
- **Line 259-322**: Update `broadcastToClients()` dan `broadcastDeviceLocationToClients()` dengan filtering
- **Line 325-339**: Update `extractShipData()` untuk include sensorId
- **Line 442-730**: Refactor message handler untuk support 4 tipe client

---

## 🎯 New Features

### 1. Four Client Types

| Type | Purpose | Validation | Filter |
|------|---------|-----------|--------|
| `sender` | Send AIS data | ✓ Sensor (app_key + user_key) | N/A |
| `viewer` | View all ships | ✗ None | None (all data) |
| `viewer-by-user` | View user's ships | ✗ None | sensorId.startsWith(user_key) |
| `viewer-by-device` | View device's ships | ✗ None | sensorId === app_key |

### 2. Sensor Validation
- Query: `sensors.findOne({ id: app_key, userId: user_key })`
- Return: `{ valid, sensorId, userId }`
- Respects `ENABLE_DEVICE_VALIDATION` flag

### 3. Broadcast Filtering
- `viewer`: Terima semua data
- `viewer-by-user`: Filter berdasarkan userKey
- `viewer-by-device`: Filter berdasarkan appKey

### 4. SensorId Storage
- Setiap AIS data disimpan dengan `sensorId` (= APP_KEY)
- Memungkinkan tracking data dari sensor mana

---

## 📊 Data Flow

```
Sender
  ↓
Identify (app_key + user_key)
  ↓
Validate Sensor
  ↓
Save sensorInfo (sensorId, userId, app_key, user_key)
  ↓
Send AIS Data
  ↓
Extract & Save with sensorId
  ↓
Broadcast to Viewers (filtered by type)
  ↓
Viewer-by-User: ✓ (jika user_key match)
Viewer-by-Device: ✓ (jika app_key match)
Viewer: ✓ (semua)
```

---

## 🗄️ Database Changes

### Sensors Collection
```javascript
{
  id: String,           // APP_KEY
  userId: String,       // USER_KEY
  // ... other fields
}
```
**Index**: `{ id: 1, userId: 1 }` (unique)

### Vessel Collection
```javascript
{
  mmsi: Number,
  sensorId: String,     // ← NEW: Reference ke sensors.id
  // ... other fields
}
```

---

## 🔐 Security

### Validation Flow
1. **Sender**: Validasi sensor dari tabel (jika ENABLE_DEVICE_VALIDATION=true)
2. **Viewer**: Tidak perlu validasi
3. **Viewer-by-User**: Tidak perlu validasi (filter di broadcast)
4. **Viewer-by-Device**: Tidak perlu validasi (filter di broadcast)

### Debug Mode
- Set `ENABLE_DEVICE_VALIDATION = false` untuk skip validasi
- Semua client diterima tanpa validasi
- Useful untuk development & testing

---

## 📝 Logging

### Identify Message
```
✓✓✓ CLIENT IDENTIFIED AS: SENDER ✓✓✓
    App Key: 69271d6712014205800cda63
    User Key: 6927168212014205800cda5f
    MAC: AA:BB:CC:DD:EE:FF
```

### Sensor Validation
```
✓ Sensor valid: APP_KEY=69271d6712014205800cda63 | USER_KEY=6927168212014205800cda5f
```

### Broadcast
```
📡 AIS Data: MMSI 123456789 | Sensor: 69271d6712014205800cda63 | Broadcasted to 2 clients
```

---

## ✅ Testing Checklist

- [ ] Sender connect dengan app_key + user_key
- [ ] Sensor validation bekerja (jika ENABLE_DEVICE_VALIDATION=true)
- [ ] sensorId disimpan di MongoDB
- [ ] Viewer standar menerima semua data
- [ ] Viewer-by-user hanya menerima data dari user yang sama
- [ ] Viewer-by-device hanya menerima data dari device yang sama
- [ ] Debug mode bekerja (ENABLE_DEVICE_VALIDATION=false)
- [ ] Broadcast count sesuai dengan filter

---

## 🚀 Deployment Steps

1. **Update Database**
   - Pastikan `sensors` collection ada
   - Buat index: `{ id: 1, userId: 1 }`
   - Insert test data

2. **Deploy Code**
   - Update `client-serial-port.js` (line 122)
   - Update `server.js` (semua perubahan)

3. **Configure**
   - Set `ENABLE_DEVICE_VALIDATION` sesuai environment
   - Verify MongoDB connection

4. **Test**
   - Connect sender dengan app_key + user_key
   - Connect viewers (all types)
   - Verify data flow & filtering

---

## 📚 Documentation

- **IMPLEMENTATION_NOTES.md**: Detailed technical documentation
- **CLIENT_EXAMPLES.md**: Code examples untuk semua client types
- **CHANGES_SUMMARY.md**: This file

---

## 🔄 Backward Compatibility

- Existing `viewer` clients tetap bekerja (tidak ada perubahan)
- Existing `sender` clients perlu update untuk include `user_key`
- Semua perubahan backward compatible dengan debug mode

---

## 📞 Support

### Common Issues

**Q: Sensor validation gagal?**
A: Verify sensors table memiliki record dengan id=APP_KEY dan userId=USER_KEY

**Q: Viewer-by-user tidak menerima data?**
A: Verify sensorId disimpan di MongoDB dan matches user_key

**Q: sensorId null di database?**
A: Verify sender mengirim app_key + user_key di identify message

---

## 🎓 Key Concepts

1. **sensorId** = APP_KEY dari sender (unique identifier untuk device)
2. **userKey** = USER_KEY dari sender (untuk filtering viewer-by-user)
3. **Broadcast Filtering** = Dilakukan di memory, tidak di database
4. **Validation** = Hanya untuk sender, viewers tidak perlu validasi
5. **Initial Data** = Di-filter berdasarkan clientType saat identify

---

## 📈 Performance Considerations

- Broadcast filtering dilakukan per-client (O(n) complexity)
- MongoDB queries menggunakan index untuk performa
- In-memory caching untuk shipsData dan deviceLocations
- Cleanup inactive ships setiap 2 menit

---

## 🔮 Future Enhancements

- [ ] Add pagination untuk get_all_ships
- [ ] Add filtering berdasarkan MMSI range
- [ ] Add real-time statistics dashboard
- [ ] Add audit logging untuk semua validasi
- [ ] Add rate limiting per sensor
- [ ] Add webhook notifications
