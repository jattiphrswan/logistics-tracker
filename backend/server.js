import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import * as store from './store.js';
import { login, logout, requireAuth, isValidSession } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Secure Socket.io connection with auth token
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (isValidSession(token)) {
    next();
  } else {
    next(new Error('Authentication error'));
  }
});

// track last known geofence membership per vehicle: { vehicleId: Set(geofenceIds inside) }
const membership = new Map();

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkGeofences(vehicleId, lat, lng) {
  const zones = store.getGeofences();
  const prevInside = membership.get(vehicleId) || new Set();
  const nowInside = new Set();

  for (const zone of zones) {
    const dist = haversineMeters(lat, lng, zone.lat, zone.lng);
    const isInside = dist <= zone.radius_m;
    if (isInside) nowInside.add(zone.id);

    const wasInside = prevInside.has(zone.id);
    if (isInside && !wasInside) {
      emitGeofenceEvent(vehicleId, zone, 'enter');
    } else if (!isInside && wasInside) {
      emitGeofenceEvent(vehicleId, zone, 'exit');
    }
  }
  membership.set(vehicleId, nowInside);
}

function emitGeofenceEvent(vehicleId, zone, event) {
  const timestamp = Date.now();
  store.addGeofenceEvent(vehicleId, zone.id, event, timestamp);
  const payload = { vehicleId, zoneId: zone.id, zoneName: zone.name, event, timestamp };
  io.emit('geofence-alert', payload);
  console.log(`[geofence] ${vehicleId} ${event} ${zone.name}`);
}

// ---- Auth ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`[auth] Login attempt for user: "${username}"`);
  const token = login(username, password);
  if (token) {
    console.log(`[auth] Login successful for user: "${username}"`);
    res.json({ token });
  } else {
    console.log(`[auth] Login failed for user: "${username}"`);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    logout(token);
  }
  res.json({ ok: true });
});

// ---- Vehicles ----
app.post('/api/vehicles', requireAuth, (req, res) => {
  const { id, name, type, routeId, cargo, driver } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  store.upsertVehicle(id, name, type, routeId, cargo, driver);
  res.json({ ok: true });
});

app.get('/api/vehicles', requireAuth, (req, res) => {
  res.json(store.getVehicles());
});

// ---- Routes ----
app.get('/api/routes', requireAuth, (req, res) => {
  res.json(store.getRoutes());
});

app.post('/api/routes', requireAuth, (req, res) => {
  const { name, waypoints } = req.body;
  if (!name || !waypoints || !Array.isArray(waypoints)) {
    return res.status(400).json({ error: 'name and waypoints required' });
  }
  const id = store.addRoute(name, waypoints);
  res.json({ id });
});

// ---- Location updates (public ingestion endpoint, e.g. for GPS trackers/simulators) ----
app.post('/api/location', (req, res) => {
  const { vehicle_id, lat, lng, speed } = req.body;
  if (!vehicle_id || lat == null || lng == null) {
    return res.status(400).json({ error: 'vehicle_id, lat, lng required' });
  }
  const timestamp = Date.now();
  store.addLocation(vehicle_id, lat, lng, speed, timestamp);
  checkGeofences(vehicle_id, lat, lng);

  const payload = { vehicle_id, lat, lng, speed: speed || 0, timestamp };
  io.emit('location-update', payload);
  res.json({ ok: true });
});

// ---- History for playback ----
app.get('/api/history/:vehicleId', requireAuth, (req, res) => {
  const { vehicleId } = req.params;
  const { date } = req.query; // YYYY-MM-DD
  res.json(store.getHistory(vehicleId, date));
});

// ---- Geofences ----
app.get('/api/geofences', requireAuth, (req, res) => {
  res.json(store.getGeofences());
});

app.post('/api/geofences', requireAuth, (req, res) => {
  const { name, lat, lng, radius_m } = req.body;
  if (!name || lat == null || lng == null || !radius_m) {
    return res.status(400).json({ error: 'name, lat, lng, radius_m required' });
  }
  const id = store.addGeofence(name, lat, lng, radius_m);
  res.json({ id });
});

app.get('/api/geofence-events', requireAuth, (req, res) => {
  res.json(store.getGeofenceEvents());
});

// ---- ETA via OSRM (free public demo server) ----
app.get('/api/eta', requireAuth, async (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;
  if (!fromLat || !fromLng || !toLat || !toLng) {
    return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng required' });
  }
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    const data = await r.json();
    if (!data.routes || !data.routes.length) {
      return res.status(404).json({ error: 'no route found' });
    }
    const route = data.routes[0];
    res.json({
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry, // GeoJSON LineString for drawing on map
    });
  } catch (err) {
    res.status(500).json({ error: 'routing service unavailable', detail: String(err) });
  }
});

// ---- Background Simulator Loop ----
const simState = new Map();

function getRealisticSpeed(type) {
  switch (type) {
    case 'motorcycle': return 55;
    case 'car': return 60;
    case 'van': return 50;
    case 'truck':
    default:
      return 40;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function runSimulationTick() {
  const vehicles = store.getVehicles();
  const routes = store.getRoutes();
  const routesMap = new Map(routes.map(r => [r.id, r]));

  for (const vehicle of vehicles) {
    // Only simulate if the vehicle has an assigned route
    if (!vehicle.routeId || !routesMap.has(vehicle.routeId)) continue;

    const route = routesMap.get(vehicle.routeId);
    const waypoints = route.waypoints;
    if (!waypoints || waypoints.length < 2) continue;

    // Get or initialize state for this vehicle
    let state = simState.get(vehicle.id);
    if (!state || state.routeId !== vehicle.routeId) {
      state = {
        routeId: vehicle.routeId,
        segmentIndex: 0,
        distanceAlongSegment: 0,
        speedKmh: getRealisticSpeed(vehicle.type),
      };
      simState.set(vehicle.id, state);
    }

    // Adjust speed slightly to feel natural
    const currentSpeed = Math.round(state.speedKmh + (Math.random() * 6 - 3));

    // Distance to travel in 3 seconds: meters = (km/h / 3.6) * 3s
    const distanceToTravel = (currentSpeed / 3.6) * 3;

    let remainingDistance = distanceToTravel;
    let segIdx = state.segmentIndex;
    let distAlong = state.distanceAlongSegment;

    while (remainingDistance > 0) {
      const p1 = waypoints[segIdx];
      const p2 = waypoints[(segIdx + 1) % waypoints.length];
      const segLength = haversineMeters(p1[0], p1[1], p2[0], p2[1]);

      const spaceLeft = segLength - distAlong;

      if (remainingDistance < spaceLeft) {
        distAlong += remainingDistance;
        remainingDistance = 0;
      } else {
        remainingDistance -= spaceLeft;
        distAlong = 0;
        segIdx = (segIdx + 1) % waypoints.length;
      }
    }

    // Save state back
    state.segmentIndex = segIdx;
    state.distanceAlongSegment = distAlong;

    // Calculate actual coordinate
    const p1 = waypoints[segIdx];
    const p2 = waypoints[(segIdx + 1) % waypoints.length];
    const segLength = haversineMeters(p1[0], p1[1], p2[0], p2[1]);
    const t = segLength > 0 ? distAlong / segLength : 0;

    const lat = lerp(p1[0], p2[0], t);
    const lng = lerp(p1[1], p2[1], t);
    const timestamp = Date.now();

    // Store the simulated location and check geofences
    store.addLocation(vehicle.id, lat, lng, currentSpeed, timestamp);
    checkGeofences(vehicle.id, lat, lng);

    // Broadcast update over socket
    const payload = { vehicle_id: vehicle.id, lat, lng, speed: currentSpeed, timestamp };
    io.emit('location-update', payload);
  }
}

// Run simulation tick every 3 seconds
setInterval(runSimulationTick, 3000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Logistics tracker backend running on http://localhost:${PORT}`);
});

