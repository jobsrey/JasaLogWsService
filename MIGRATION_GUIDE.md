# Migration Guide - Multi-Viewer Implementation

## Overview
Panduan untuk migrate dari implementasi lama ke multi-viewer dengan sensor validation.

---

## Phase 1: Pre-Migration (Preparation)

### 1.1 Backup Database
```bash
# Backup semua data
mongodump --uri="mongodb://root:password@host:27017/app_jasalog" --out=/backup/pre-migration

# Atau backup specific collections
mongodump --uri="mongodb://root:password@host:27017/app_jasalog" \
  --collection=vessel --collection=sensors --out=/backup/pre-migration
```

### 1.2 Create Sensors Collection
```javascript
// Connect ke MongoDB
use app_jasalog

// Create sensors collection
db.createCollection("sensors")

// Create index
db.sensors.createIndex({ id: 1, userId: 1 }, { unique: true })

// Insert test data
db.sensors.insertOne({
  id: "69271d6712014205800cda63",
  userId: "6927168212014205800cda5f",
  name: "R400NG Receiver 1",
  description: "AIS Receiver at Port",
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### 1.3 Verify Existing Data
```javascript
// Check existing vessel data
db.vessel.findOne()

// Check if sensorId field exists
db.vessel.findOne({ sensorId: { $exists: true } })

// Count vessels
db.vessel.countDocuments()
```

---

## Phase 2: Code Deployment

### 2.1 Update Client-Serial-Port.js
**File**: `client-serial-port.js`

**Change**: Line 122
```javascript
// OLD:
wsClient.send(JSON.stringify({
  type: 'identify',
  clientType: 'sender',
  app_key: APP_KEY,
  mac_address: deviceMacAddress
}));

// NEW:
wsClient.send(JSON.stringify({
  type: 'identify',
  clientType: 'sender',
  app_key: APP_KEY,
  user_key: USER_KEY,  // ← ADD THIS
  mac_address: deviceMacAddress
}));
```

**Verification**:
```bash
# Check if user_key is included
grep -n "user_key: USER_KEY" client-serial-port.js
```

### 2.2 Update Server.js
**File**: `server.js`

**Changes**:
1. Line 18: Add SENSORS_COLLECTION_NAME
2. Line 26: Add sensorsCollection variable
3. Line 43: Initialize sensorsCollection
4. Line 55: Create index for sensors
5. Line 102-133: Add validateSensor function
6. Line 259-322: Update broadcast functions
7. Line 325-339: Update extractShipData function
8. Line 442-730: Update message handler

**Verification**:
```bash
# Check if all changes are in place
grep -n "validateSensor" server.js
grep -n "viewer-by-user" server.js
grep -n "viewer-by-device" server.js
grep -n "sensorId" server.js
```

### 2.3 Backup Old Server
```bash
# Create backup of old server.js
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
```

---

## Phase 3: Testing (Development Environment)

### 3.1 Start Server
```bash
# Set debug mode
export ENABLE_DEVICE_VALIDATION=false

# Start server
node server.js

# Expected output:
# ✓ MongoDB connected successfully
# 🌐 AIS WEBSOCKET SERVER
# WebSocket Server : ws://0.0.0.0:8080
# Device Validation: 🔧 DISABLED (DEBUG MODE)
```

### 3.2 Test Sender Connection
```bash
# Terminal 1: Start server
node server.js

# Terminal 2: Test sender
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'identify',
    clientType: 'sender',
    app_key: '69271d6712014205800cda63',
    user_key: '6927168212014205800cda5f',
    mac_address: 'AA:BB:CC:DD:EE:FF'
  }));
  console.log('Identify sent');
});
ws.on('message', (data) => console.log('Message:', data));
"
```

**Expected Server Log**:
```
✓✓✓ CLIENT IDENTIFIED AS: SENDER ✓✓✓
    App Key: 69271d6712014205800cda63
    User Key: 6927168212014205800cda5f
    MAC: AA:BB:CC:DD:EE:FF
✓ Sensor valid: APP_KEY=69271d6712014205800cda63 | USER_KEY=6927168212014205800cda5f
```

### 3.3 Test Viewer Connection
```bash
# Terminal 3: Test viewer
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'identify',
    clientType: 'viewer'
  }));
  console.log('Viewer identify sent');
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Message type:', msg.type);
  if (msg.type === 'initial_data') {
    console.log('Ships:', msg.count);
  }
});
"
```

### 3.4 Test Viewer-by-User Connection
```bash
# Terminal 4: Test viewer-by-user
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'identify',
    clientType: 'viewer-by-user',
    user_key: '6927168212014205800cda5f'
  }));
  console.log('Viewer-by-user identify sent');
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Message type:', msg.type);
  if (msg.type === 'initial_data') {
    console.log('Ships for user:', msg.count);
  }
});
"
```

### 3.5 Test Viewer-by-Device Connection
```bash
# Terminal 5: Test viewer-by-device
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'identify',
    clientType: 'viewer-by-device',
    app_key: '69271d6712014205800cda63'
  }));
  console.log('Viewer-by-device identify sent');
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Message type:', msg.type);
  if (msg.type === 'initial_data') {
    console.log('Ships for device:', msg.count);
  }
});
"
```

### 3.6 Test AIS Data Broadcast
```bash
# Terminal 6: Send AIS data from sender
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  // First identify
  ws.send(JSON.stringify({
    type: 'identify',
    clientType: 'sender',
    app_key: '69271d6712014205800cda63',
    user_key: '6927168212014205800cda5f',
    mac_address: 'AA:BB:CC:DD:EE:FF'
  }));
  
  // Wait 1 second then send AIS data
  setTimeout(() => {
    ws.send(JSON.stringify({
      app_key: '69271d6712014205800cda63',
      user_key: '6927168212014205800cda5f',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      source: 'test',
      sourcePort: 'test',
      receivedAt: new Date().toISOString(),
      dataCount: 1,
      aisData: [{
        message: '!AIVDM,1,1,,A,15M67FC000G?ufbE\`FepT@3n00Sa,0*5C',
        timestamp: new Date().toISOString(),
        decoded: {
          type: 1,
          mmsi: 123456789,
          status: 0,
          lat: -6.123456,
          lon: 106.789012,
          speed: 12.5,
          course: 180,
          heading: 180,
          country: 'Indonesia',
          countryCode: 'ID'
        }
      }]
    }));
    console.log('AIS data sent');
  }, 1000);
});
"
```

**Expected Server Log**:
```
📡 AIS Data: MMSI 123456789 | Sensor: 69271d6712014205800cda63 | Broadcasted to 3 clients
  Country: Indonesia (ID)
  Position: -6.123456, 106.789012 | Speed: 12.5 knots
```

### 3.7 Verify MongoDB
```javascript
// Check if sensorId was saved
db.vessel.findOne({ mmsi: 123456789 })

// Expected output:
{
  _id: ObjectId(...),
  mmsi: 123456789,
  sensorId: "69271d6712014205800cda63",  // ← Should be here
  // ... other fields
}
```

---

## Phase 4: Validation

### 4.1 Checklist
- [ ] Server starts without errors
- [ ] Sender can connect with app_key + user_key
- [ ] Sensor validation works (debug mode)
- [ ] Viewer receives all data
- [ ] Viewer-by-user receives filtered data
- [ ] Viewer-by-device receives filtered data
- [ ] sensorId saved in MongoDB
- [ ] Broadcast count matches expected viewers

### 4.2 Error Scenarios
```javascript
// Test 1: Sender without user_key
// Expected: Should fail validation (if ENABLE_DEVICE_VALIDATION=true)
{
  type: 'identify',
  clientType: 'sender',
  app_key: '69271d6712014205800cda63',
  mac_address: 'AA:BB:CC:DD:EE:FF'
  // Missing: user_key
}

// Test 2: Invalid sensor (app_key + user_key not in sensors table)
// Expected: Should disconnect (if ENABLE_DEVICE_VALIDATION=true)
{
  type: 'identify',
  clientType: 'sender',
  app_key: 'INVALID_KEY',
  user_key: 'INVALID_USER',
  mac_address: 'AA:BB:CC:DD:EE:FF'
}

// Test 3: Viewer-by-user with no matching data
// Expected: Should receive empty ships array
{
  type: 'identify',
  clientType: 'viewer-by-user',
  user_key: 'NONEXISTENT_USER'
}
```

---

## Phase 5: Production Deployment

### 5.1 Enable Validation
```javascript
// server.js line 10
const ENABLE_DEVICE_VALIDATION = true;  // Change from false to true
```

### 5.2 Verify Sensors Table
```javascript
// Make sure all senders have entries in sensors table
db.sensors.find().pretty()

// Expected: At least one entry per sender
{
  id: "69271d6712014205800cda63",
  userId: "6927168212014205800cda5f",
  name: "R400NG Receiver 1",
  status: "active"
}
```

### 5.3 Deploy to Production
```bash
# 1. Stop old server
pkill -f "node server.js"

# 2. Deploy new code
git pull origin main
# or manually copy files

# 3. Start new server
node server.js

# 4. Monitor logs
tail -f server.log
```

### 5.4 Verify Production
```bash
# Test sender connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  ws://production-server:8080

# Check server stats
# Should show: Viewers: X, Senders: Y
```

---

## Phase 6: Rollback Plan

### 6.1 If Issues Occur
```bash
# 1. Stop new server
pkill -f "node server.js"

# 2. Restore old server
cp server.js.backup.* server.js

# 3. Restore old client (if needed)
cp client-serial-port.js.backup.* client-serial-port.js

# 4. Start old server
node server.js

# 5. Restore database (if needed)
mongorestore --uri="mongodb://root:password@host:27017/app_jasalog" \
  /backup/pre-migration/app_jasalog
```

### 6.2 Common Issues & Solutions

**Issue**: Sensor validation fails
```
Solution:
1. Check sensors table has correct entries
2. Verify app_key and user_key match
3. Set ENABLE_DEVICE_VALIDATION=false temporarily
4. Check server logs for validation errors
```

**Issue**: sensorId is null in database
```
Solution:
1. Verify sender sends app_key + user_key
2. Check validateSensor returns valid sensorId
3. Verify extractShipData receives sensorId parameter
4. Check MongoDB insert operation
```

**Issue**: Viewer-by-user not receiving data
```
Solution:
1. Verify sensorId matches user_key
2. Check filtering logic in broadcastToClients
3. Verify viewer sends correct user_key
4. Check server logs for broadcast count
```

---

## Phase 7: Post-Migration

### 7.1 Data Migration (if needed)
```javascript
// Add sensorId to existing vessels without it
db.vessel.updateMany(
  { sensorId: { $exists: false } },
  { $set: { sensorId: null } }
)

// Or if you have app_key mapping:
db.vessel.updateMany(
  { sensorId: { $exists: false }, app_key: { $exists: true } },
  [
    { $set: { sensorId: "$app_key" } }
  ]
)
```

### 7.2 Cleanup Old Data
```javascript
// Remove vessels older than 30 days
db.vessel.deleteMany({
  lastUpdate: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
})
```

### 7.3 Monitor Performance
```javascript
// Check index usage
db.vessel.aggregate([{ $indexStats: {} }])

// Check slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().limit(5).sort({ ts: -1 }).pretty()
```

### 7.4 Documentation
- [ ] Update API documentation
- [ ] Update client examples
- [ ] Update deployment guide
- [ ] Update monitoring guide
- [ ] Train team on new features

---

## Rollback Checklist

- [ ] Old server code backed up
- [ ] Old database backed up
- [ ] Rollback procedure tested
- [ ] Team trained on rollback
- [ ] Monitoring alerts configured
- [ ] Support team on standby

---

## Success Criteria

✅ All 4 client types working
✅ Sensor validation working (if enabled)
✅ sensorId saved in all vessels
✅ Broadcast filtering working correctly
✅ No data loss
✅ Performance acceptable
✅ All tests passing
✅ Documentation updated

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Pre-Migration | 1 hour | Preparation |
| Code Deployment | 30 min | Implementation |
| Testing | 2-4 hours | Validation |
| Production Deploy | 30 min | Deployment |
| Post-Migration | 1 hour | Cleanup |

**Total**: ~5-6 hours

---

## Support

For issues during migration:
1. Check server logs: `tail -f server.log`
2. Check MongoDB: `db.vessel.findOne()`
3. Review IMPLEMENTATION_NOTES.md
4. Check CLIENT_EXAMPLES.md for test cases
5. Contact support team
