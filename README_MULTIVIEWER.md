# Multi-Viewer & Sensor Validation - README

## 🎯 Quick Start

### What's New?
Implementasi fitur multi-viewer dengan validasi sensor berdasarkan APP_KEY dan USER_KEY dari tabel `sensors`.

### 4 Client Types
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT TYPES                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. SENDER                                               │
│    └─ Send AIS data                                     │
│    └─ Requires: app_key + user_key validation           │
│    └─ Stores: sensorId in vessel collection             │
│                                                         │
│ 2. VIEWER                                               │
│    └─ View all ships from all senders                   │
│    └─ No validation, no filtering                       │
│    └─ Backward compatible                               │
│                                                         │
│ 3. VIEWER-BY-USER                                       │
│    └─ View only ships from same user                    │
│    └─ Filter: sensorId.startsWith(user_key)             │
│    └─ No validation required                            │
│                                                         │
│ 4. VIEWER-BY-DEVICE                                     │
│    └─ View only ships from specific device              │
│    └─ Filter: sensorId === app_key                      │
│    └─ No validation required                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| **CHANGES_SUMMARY.md** | Quick overview of all changes | 5 min |
| **IMPLEMENTATION_NOTES.md** | Detailed technical documentation | 15 min |
| **CLIENT_EXAMPLES.md** | Code examples for all client types | 10 min |
| **DATABASE_SCHEMA.md** | Complete database schema & queries | 15 min |
| **MIGRATION_GUIDE.md** | Step-by-step migration guide | 20 min |

### Recommended Reading Order
1. **Start here**: CHANGES_SUMMARY.md (5 min)
2. **Then**: CLIENT_EXAMPLES.md (10 min)
3. **Deep dive**: IMPLEMENTATION_NOTES.md (15 min)
4. **Database**: DATABASE_SCHEMA.md (15 min)
5. **Deploy**: MIGRATION_GUIDE.md (20 min)

---

## 🚀 Quick Implementation

### Step 1: Update Client
```javascript
// client-serial-port.js - Line 122
wsClient.send(JSON.stringify({
  type: 'identify',
  clientType: 'sender',
  app_key: APP_KEY,
  user_key: USER_KEY,  // ← ADD THIS
  mac_address: deviceMacAddress
}));
```

### Step 2: Update Server
- Modify `server.js` (see IMPLEMENTATION_NOTES.md for details)
- Add sensors collection & validation
- Update broadcast functions
- Add sensorId to vessel data

### Step 3: Setup Database
```javascript
// Create sensors collection
db.sensors.createIndex({ id: 1, userId: 1 }, { unique: true })

// Insert test data
db.sensors.insertOne({
  id: "69271d6712014205800cda63",
  userId: "6927168212014205800cda5f",
  name: "R400NG Receiver 1",
  status: "active"
})
```

### Step 4: Test
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
});
"
```

---

## 🔑 Key Concepts

### sensorId
- **What**: Unique identifier for each device/sensor
- **Value**: APP_KEY from sender
- **Usage**: Stored in vessel collection for tracking
- **Filter**: Used by viewer-by-device

### userKey
- **What**: User identifier
- **Value**: USER_KEY from sender
- **Usage**: For filtering viewer-by-user
- **Filter**: sensorId.startsWith(userKey)

### Broadcast Filtering
- **Where**: Done in memory (not database)
- **When**: When sending ship_update to viewers
- **How**: Check client.userKey or client.appKey
- **Result**: Each viewer gets only relevant data

### Validation
- **Who**: Only sender needs validation
- **What**: Verify app_key + user_key in sensors table
- **When**: During identify message
- **Flag**: ENABLE_DEVICE_VALIDATION (default: false)

---

## 📊 Data Flow

```
SENDER
  ↓
Send Identify (app_key + user_key)
  ↓
Validate Sensor
  ├─ Query: sensors.findOne({ id: app_key, userId: user_key })
  ├─ If valid: Save sensorInfo
  └─ If invalid: Disconnect (if validation enabled)
  ↓
Send AIS Data
  ├─ Extract ship data
  ├─ Add sensorId (= app_key)
  ├─ Save to MongoDB
  └─ Broadcast to viewers
  ↓
BROADCAST FILTERING
  ├─ viewer: ✓ All data
  ├─ viewer-by-user: ✓ If user_key matches
  ├─ viewer-by-device: ✓ If app_key matches
  └─ sender: ✗ No broadcast
```

---

## 🧪 Testing Scenarios

### Scenario 1: Sender Connection
```javascript
// Expected: Sensor validation succeeds
{
  type: 'identify',
  clientType: 'sender',
  app_key: '69271d6712014205800cda63',
  user_key: '6927168212014205800cda5f',
  mac_address: 'AA:BB:CC:DD:EE:FF'
}

// Server logs:
// ✓✓✓ CLIENT IDENTIFIED AS: SENDER ✓✓✓
// ✓ Sensor valid: APP_KEY=... | USER_KEY=...
```

### Scenario 2: Viewer Connection
```javascript
// Expected: Receives all ships
{
  type: 'identify',
  clientType: 'viewer'
}

// Server logs:
// ✓✓✓ CLIENT IDENTIFIED AS: VIEWER ✓✓✓
// Sent X ships and Y devices to viewer
```

### Scenario 3: Viewer-by-User Connection
```javascript
// Expected: Receives only user's ships
{
  type: 'identify',
  clientType: 'viewer-by-user',
  user_key: '6927168212014205800cda5f'
}

// Server logs:
// ✓✓✓ CLIENT IDENTIFIED AS: VIEWER-BY-USER ✓✓✓
// Sent X ships (filtered by user) and Y devices
```

### Scenario 4: Viewer-by-Device Connection
```javascript
// Expected: Receives only device's ships
{
  type: 'identify',
  clientType: 'viewer-by-device',
  app_key: '69271d6712014205800cda63'
}

// Server logs:
// ✓✓✓ CLIENT IDENTIFIED AS: VIEWER-BY-DEVICE ✓✓✓
// Sent X ships (filtered by device) and Y devices
```

---

## ⚙️ Configuration

### Debug Mode (Development)
```javascript
// server.js - Line 10
const ENABLE_DEVICE_VALIDATION = false;

// Effect:
// - All clients accepted without validation
// - Useful for development & testing
// - Logs show "DEBUG MODE" messages
```

### Production Mode
```javascript
// server.js - Line 10
const ENABLE_DEVICE_VALIDATION = true;

// Effect:
// - Sender validation required
// - Invalid sensors disconnected
// - Viewers not affected
```

---

## 🐛 Troubleshooting

### Problem: Sensor validation fails
```
Solution:
1. Check sensors table has correct entries
2. Verify app_key and user_key match
3. Set ENABLE_DEVICE_VALIDATION=false temporarily
4. Check server logs for validation errors
```

### Problem: sensorId is null in database
```
Solution:
1. Verify sender sends app_key + user_key
2. Check validateSensor returns valid sensorId
3. Verify extractShipData receives sensorId parameter
4. Check MongoDB insert operation
```

### Problem: Viewer-by-user not receiving data
```
Solution:
1. Verify sensorId matches user_key
2. Check filtering logic in broadcastToClients
3. Verify viewer sends correct user_key
4. Check server logs for broadcast count
```

### Problem: Broadcast count is 0
```
Solution:
1. Verify viewers are connected
2. Check viewer identify message received
3. Verify viewer clientType is set
4. Check server logs for viewer connections
```

---

## 📈 Performance Tips

1. **Use Indexes**: Ensure indexes on sensorId in vessel collection
2. **Pagination**: Implement pagination for large result sets
3. **Filtering**: Do filtering in memory for better performance
4. **Caching**: Use in-memory cache for frequently accessed data
5. **Monitoring**: Monitor slow queries with MongoDB profiler

---

## 🔐 Security Considerations

1. **Validation**: Always validate sensor credentials (production)
2. **Encryption**: Use TLS/SSL for WebSocket connections
3. **Authentication**: Implement proper authentication layer
4. **Authorization**: Verify user permissions before sending data
5. **Rate Limiting**: Implement rate limiting per sensor

---

## 📋 Checklist

### Pre-Deployment
- [ ] Backup database
- [ ] Create sensors collection
- [ ] Insert test data
- [ ] Update client code
- [ ] Update server code
- [ ] Test all 4 client types

### Deployment
- [ ] Stop old server
- [ ] Deploy new code
- [ ] Start new server
- [ ] Verify connections
- [ ] Monitor logs

### Post-Deployment
- [ ] Verify sensorId in database
- [ ] Test broadcast filtering
- [ ] Monitor performance
- [ ] Update documentation
- [ ] Train team

---

## 📞 Support

### Documentation
- See IMPLEMENTATION_NOTES.md for technical details
- See CLIENT_EXAMPLES.md for code examples
- See DATABASE_SCHEMA.md for database details
- See MIGRATION_GUIDE.md for deployment steps

### Common Commands
```bash
# Start server
node server.js

# Check server status
curl -i ws://localhost:8080

# View logs
tail -f server.log

# Test with wscat
wscat -c ws://localhost:8080
```

### Debugging
```javascript
// Check sensors table
db.sensors.find().pretty()

// Check vessel data
db.vessel.findOne({ mmsi: 123456789 })

// Count ships per sensor
db.vessel.aggregate([
  { $group: { _id: "$sensorId", count: { $sum: 1 } } }
])
```

---

## 🎓 Learning Resources

### For Developers
1. Read IMPLEMENTATION_NOTES.md (15 min)
2. Review CLIENT_EXAMPLES.md (10 min)
3. Study DATABASE_SCHEMA.md (15 min)
4. Test with provided examples (30 min)

### For DevOps
1. Read MIGRATION_GUIDE.md (20 min)
2. Review CHANGES_SUMMARY.md (5 min)
3. Plan deployment (30 min)
4. Execute migration (5-6 hours)

### For QA
1. Review CLIENT_EXAMPLES.md (10 min)
2. Test all 4 client types (1 hour)
3. Verify database changes (30 min)
4. Check broadcast filtering (1 hour)

---

## 📝 Version History

### v1.0.0 (Current)
- ✓ Multi-viewer support (4 types)
- ✓ Sensor validation
- ✓ sensorId storage
- ✓ Broadcast filtering
- ✓ Debug mode
- ✓ Backward compatible

---

## 📄 License

This implementation is part of the JasaLog WebSocket Service project.

---

## 🤝 Contributing

For improvements or bug reports:
1. Document the issue clearly
2. Provide test case
3. Submit pull request
4. Update documentation

---

## ✨ Summary

This implementation provides:
- ✅ Multi-viewer support with 4 different client types
- ✅ Sensor validation from database
- ✅ Broadcast filtering based on user/device
- ✅ sensorId tracking in database
- ✅ Debug mode for development
- ✅ Backward compatibility
- ✅ Comprehensive documentation
- ✅ Migration guide

**Status**: ✅ READY FOR PRODUCTION

**Next Steps**:
1. Setup sensors table
2. Test all client types
3. Enable validation
4. Deploy to production
