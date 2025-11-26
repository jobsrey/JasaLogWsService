# Client Examples - Multi-Viewer Implementation

## 1. Sender Client (Node.js)

```javascript
import WebSocket from 'ws';

const WEBSOCKET_SERVER = 'ws://localhost:8080';
const APP_KEY = '69271d6712014205800cda63';
const USER_KEY = '6927168212014205800cda5f';

let ws = null;

function connectSender() {
  ws = new WebSocket(WEBSOCKET_SERVER);
  
  ws.on('open', () => {
    console.log('Connected as sender');
    
    // Send identify message
    ws.send(JSON.stringify({
      type: 'identify',
      clientType: 'sender',
      app_key: APP_KEY,
      user_key: USER_KEY,
      mac_address: 'AA:BB:CC:DD:EE:FF'
    }));
  });
  
  ws.on('message', (data) => {
    console.log('Message from server:', JSON.parse(data));
  });
  
  ws.on('close', () => {
    console.log('Disconnected, reconnecting in 5s...');
    setTimeout(connectSender, 5000);
  });
}

function sendAISData(aisMessages) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      app_key: APP_KEY,
      user_key: USER_KEY,
      mac_address: 'AA:BB:CC:DD:EE:FF',
      source: 'R400NG_Serial',
      sourcePort: 'COM3',
      receivedAt: new Date().toISOString(),
      dataCount: aisMessages.length,
      aisData: aisMessages
    }));
  }
}

connectSender();
```

---

## 2. Viewer Client (HTML/JavaScript)

```html
<!DOCTYPE html>
<html>
<head>
  <title>AIS Viewer - All Ships</title>
</head>
<body>
  <h1>AIS Viewer - All Ships</h1>
  <div id="ships"></div>

  <script>
    const WEBSOCKET_SERVER = 'ws://localhost:8080';
    let ws = null;

    function connectViewer() {
      ws = new WebSocket(WEBSOCKET_SERVER);
      
      ws.onopen = () => {
        console.log('Connected as viewer');
        
        // Send identify message
        ws.send(JSON.stringify({
          type: 'identify',
          clientType: 'viewer'
        }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'initial_data') {
          console.log('Received initial data:', data.ships.length, 'ships');
          displayShips(data.ships);
        } else if (data.type === 'ship_update') {
          console.log('Ship update:', data.ship.mmsi);
          updateShip(data.ship);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected, reconnecting in 5s...');
        setTimeout(connectViewer, 5000);
      };
    }

    function displayShips(ships) {
      const container = document.getElementById('ships');
      container.innerHTML = ships.map(ship => `
        <div>
          <h3>${ship.name || 'Unknown'} (MMSI: ${ship.mmsi})</h3>
          <p>Position: ${ship.lat?.toFixed(6)}, ${ship.lon?.toFixed(6)}</p>
          <p>Speed: ${ship.speed} knots</p>
          <p>Sensor: ${ship.sensorId}</p>
        </div>
      `).join('');
    }

    function updateShip(ship) {
      // Update UI dengan data kapal terbaru
      console.log('Updated ship:', ship);
    }

    connectViewer();
  </script>
</body>
</html>
```

---

## 3. Viewer-by-User Client (HTML/JavaScript)

```html
<!DOCTYPE html>
<html>
<head>
  <title>AIS Viewer - My Ships</title>
</head>
<body>
  <h1>AIS Viewer - My Ships (User-Filtered)</h1>
  <div id="ships"></div>

  <script>
    const WEBSOCKET_SERVER = 'ws://localhost:8080';
    const USER_KEY = '6927168212014205800cda5f';
    let ws = null;

    function connectViewerByUser() {
      ws = new WebSocket(WEBSOCKET_SERVER);
      
      ws.onopen = () => {
        console.log('Connected as viewer-by-user');
        
        // Send identify message dengan user_key
        ws.send(JSON.stringify({
          type: 'identify',
          clientType: 'viewer-by-user',
          user_key: USER_KEY
        }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'initial_data') {
          console.log('Received initial data:', data.ships.length, 'ships for user', data.userId);
          displayShips(data.ships);
        } else if (data.type === 'ship_update') {
          console.log('Ship update:', data.ship.mmsi);
          updateShip(data.ship);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected, reconnecting in 5s...');
        setTimeout(connectViewerByUser, 5000);
      };
    }

    function displayShips(ships) {
      const container = document.getElementById('ships');
      container.innerHTML = ships.map(ship => `
        <div>
          <h3>${ship.name || 'Unknown'} (MMSI: ${ship.mmsi})</h3>
          <p>Position: ${ship.lat?.toFixed(6)}, ${ship.lon?.toFixed(6)}</p>
          <p>Speed: ${ship.speed} knots</p>
          <p>Sensor: ${ship.sensorId}</p>
          <p>Country: ${ship.country || 'Unknown'}</p>
        </div>
      `).join('');
    }

    function updateShip(ship) {
      console.log('Updated ship:', ship);
    }

    connectViewerByUser();
  </script>
</body>
</html>
```

---

## 4. Viewer-by-Device Client (HTML/JavaScript)

```html
<!DOCTYPE html>
<html>
<head>
  <title>AIS Viewer - Device Specific</title>
</head>
<body>
  <h1>AIS Viewer - Device Specific Ships</h1>
  <div id="ships"></div>

  <script>
    const WEBSOCKET_SERVER = 'ws://localhost:8080';
    const APP_KEY = '69271d6712014205800cda63';
    let ws = null;

    function connectViewerByDevice() {
      ws = new WebSocket(WEBSOCKET_SERVER);
      
      ws.onopen = () => {
        console.log('Connected as viewer-by-device');
        
        // Send identify message dengan app_key
        ws.send(JSON.stringify({
          type: 'identify',
          clientType: 'viewer-by-device',
          app_key: APP_KEY
        }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'initial_data') {
          console.log('Received initial data:', data.ships.length, 'ships for device', data.appKey);
          displayShips(data.ships);
        } else if (data.type === 'ship_update') {
          console.log('Ship update:', data.ship.mmsi);
          updateShip(data.ship);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected, reconnecting in 5s...');
        setTimeout(connectViewerByDevice, 5000);
      };
    }

    function displayShips(ships) {
      const container = document.getElementById('ships');
      container.innerHTML = ships.map(ship => `
        <div>
          <h3>${ship.name || 'Unknown'} (MMSI: ${ship.mmsi})</h3>
          <p>Position: ${ship.lat?.toFixed(6)}, ${ship.lon?.toFixed(6)}</p>
          <p>Speed: ${ship.speed} knots</p>
          <p>Course: ${ship.course}°</p>
          <p>Country: ${ship.country || 'Unknown'}</p>
        </div>
      `).join('');
    }

    function updateShip(ship) {
      console.log('Updated ship:', ship);
    }

    connectViewerByDevice();
  </script>
</body>
</html>
```

---

## 5. Request All Ships (Any Viewer Type)

```javascript
// Dari client viewer (any type)
ws.send(JSON.stringify({
  type: 'get_all_ships'
}));

// Response dari server:
{
  type: 'all_ships',
  ships: [
    {
      mmsi: 123456789,
      name: 'Ship Name',
      lat: -6.123456,
      lon: 106.789012,
      speed: 12.5,
      course: 180,
      heading: 180,
      country: 'Indonesia',
      countryCode: 'ID',
      sensorId: '69271d6712014205800cda63',
      // ... other fields
    }
  ],
  count: 1
}
```

---

## 6. Device Location Update

```javascript
// Dari sender
ws.send(JSON.stringify({
  app_key: APP_KEY,
  user_key: USER_KEY,
  mac_address: 'AA:BB:CC:DD:EE:FF',
  deviceLocation: {
    latitude: -6.123456,
    longitude: 106.789012,
    name: 'Device Location',
    description: 'R400NG Receiver'
  },
  source: 'R400NG_Serial',
  sourcePort: 'COM3'
}));

// Broadcast ke semua viewer (filtered by type):
{
  type: 'device_location_update',
  device: {
    app_key: '69271d6712014205800cda63',
    mac_address: 'AA:BB:CC:DD:EE:FF',
    latitude: -6.123456,
    longitude: 106.789012,
    name: 'Device Location',
    description: 'R400NG Receiver',
    source: 'R400NG_Serial',
    sourcePort: 'COM3',
    lastUpdate: '2025-11-26T10:46:00.000Z'
  }
}
```

---

## 7. AIS Data Message Format

```javascript
// Sender mengirim AIS data
{
  app_key: '69271d6712014205800cda63',
  user_key: '6927168212014205800cda5f',
  mac_address: 'AA:BB:CC:DD:EE:FF',
  source: 'R400NG_Serial',
  sourcePort: 'COM3',
  receivedAt: '2025-11-26T10:46:00.000Z',
  dataCount: 2,
  aisData: [
    {
      message: '!AIVDM,1,1,,A,15M67FC000G?ufbE`FepT@3n00Sa,0*5C',
      timestamp: '2025-11-26T10:46:00.000Z',
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
    },
    {
      message: '!AIVDM,2,1,3,B,55?MbV02>H;s<HtKR20EHE:0@T4@Dn2222222216L961O5Gf0NSQEp6ClRp8,0*1C',
      timestamp: '2025-11-26T10:46:01.000Z',
      decoded: {
        type: 5,
        mmsi: 123456789,
        imo: 1234567,
        callsign: 'CALLSIGN',
        shipname: 'SHIP NAME',
        shiptype: 70,
        destination: 'DESTINATION',
        country: 'Indonesia',
        countryCode: 'ID'
      }
    }
  ]
}

// Server broadcast ke viewer:
{
  type: 'ship_update',
  ship: {
    mmsi: 123456789,
    sensorId: '69271d6712014205800cda63',
    timestamp: '2025-11-26T10:46:00.000Z',
    messageType: 1,
    country: 'Indonesia',
    countryCode: 'ID',
    lat: -6.123456,
    lon: 106.789012,
    speed: 12.5,
    course: 180,
    heading: 180,
    navStatus: 0,
    name: 'SHIP NAME',
    callsign: 'CALLSIGN',
    shipType: 70,
    destination: 'DESTINATION',
    imo: 1234567,
    lastUpdate: '2025-11-26T10:46:00.000Z'
  }
}
```

---

## Testing dengan cURL/WebSocket CLI

### 1. Connect sebagai Sender
```bash
# Menggunakan websocat atau wscat
wscat -c ws://localhost:8080

# Send identify
{"type":"identify","clientType":"sender","app_key":"69271d6712014205800cda63","user_key":"6927168212014205800cda5f","mac_address":"AA:BB:CC:DD:EE:FF"}

# Send AIS data
{"app_key":"69271d6712014205800cda63","user_key":"6927168212014205800cda5f","mac_address":"AA:BB:CC:DD:EE:FF","source":"test","sourcePort":"test","receivedAt":"2025-11-26T10:46:00.000Z","dataCount":1,"aisData":[{"message":"!AIVDM,1,1,,A,15M67FC000G?ufbE`FepT@3n00Sa,0*5C","timestamp":"2025-11-26T10:46:00.000Z","decoded":{"type":1,"mmsi":123456789,"status":0,"lat":-6.123456,"lon":106.789012,"speed":12.5,"course":180,"heading":180,"country":"Indonesia","countryCode":"ID"}}]}
```

### 2. Connect sebagai Viewer
```bash
wscat -c ws://localhost:8080

# Send identify
{"type":"identify","clientType":"viewer"}

# Request all ships
{"type":"get_all_ships"}
```

### 3. Connect sebagai Viewer-by-User
```bash
wscat -c ws://localhost:8080

# Send identify
{"type":"identify","clientType":"viewer-by-user","user_key":"6927168212014205800cda5f"}
```

### 4. Connect sebagai Viewer-by-Device
```bash
wscat -c ws://localhost:8080

# Send identify
{"type":"identify","clientType":"viewer-by-device","app_key":"69271d6712014205800cda63"}
```

---

## Debugging Tips

1. **Enable Debug Mode**: Set `ENABLE_DEVICE_VALIDATION = false` di server.js
2. **Check Logs**: Server akan log semua identify messages dan validasi
3. **Monitor Broadcasts**: Lihat berapa banyak clients yang menerima setiap update
4. **Check MongoDB**: Verify sensorId disimpan di vessel collection
5. **Test Filtering**: Connect multiple viewers dan verify filtering bekerja

---

## Common Issues

### Issue: Viewer tidak menerima data
**Solution**: 
- Verify sender sudah tervalidasi
- Check server logs untuk broadcast count
- Verify viewer sudah send identify message

### Issue: Sensor validation gagal
**Solution**:
- Verify sensors table memiliki record dengan id=APP_KEY dan userId=USER_KEY
- Check ENABLE_DEVICE_VALIDATION flag
- Review server logs untuk validation errors

### Issue: Viewer-by-user tidak menerima data
**Solution**:
- Verify sensorId disimpan di vessel collection
- Verify sensorId matches atau starts with user_key
- Check filtering logic di broadcast function

### Issue: sensorId null di database
**Solution**:
- Verify sender mengirim app_key dan user_key di identify message
- Verify sensor validation berhasil
- Check extractShipData menerima sensorId parameter
