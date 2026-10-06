import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import * as store from './store.js';
import { login, logout, requireAuth, isValidSession } from './auth.js';
import { getRoadRoute, haversineMeters } from './routing.js';

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
  const payload = {
    vehicle_id: vehicleId,
    geofence_id: zone.id,
    geofence_name: zone.name,
    event,
    timestamp,
  };
  io.emit('geofence-alert', payload);
  console.log(`[geofence] ${vehicleId} ${event} ${zone.name}`);
}

// ---- Authentication Routes ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`[auth] Login attempt for user: "${username}"`);
  const token = login(username, password);
  if (token) {
    console.log(`[auth] Login successful for user: "${username}"`);
    res.json({ token, username });
  } else {
    console.log(`[auth] Login failed for user: "${username}"`);
    res.status(401).json({ error: 'Invalid username or password' });
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

// ---- Fleet Management API Routes ----
app.get('/api/vehicles', requireAuth, (req, res) => {
  res.json(store.getVehicles());
});

app.post('/api/vehicles', requireAuth, (req, res) => {
  const { id, name, type, routeId, cargo, driver } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'id and name required' });
  }
  store.upsertVehicle(id, name, type, routeId, cargo, driver);
  res.json({ ok: true });
});

// ---- Routes ----
app.get('/api/routes', requireAuth, (req, res) => {
  res.json(store.getRoutes());
});

app.post('/api/routes', requireAuth, async (req, res) => {
  const { name, waypoints } = req.body;
  if (!name || !waypoints || !Array.isArray(waypoints)) {
    return res.status(400).json({ error: 'name and waypoints required' });
  }
  try {
    const roadData = await getRoadRoute(waypoints);
    const id = store.addRoute(
      name,
      waypoints,
      roadData.roadCoordinates,
      roadData.distanceMeters,
      roadData.durationSeconds
    );
    res.json({
      id,
      name,
      waypoints,
      roadCoordinates: roadData.roadCoordinates,
      distanceMeters: roadData.distanceMeters,
      durationSeconds: roadData.durationSeconds,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create route', detail: err.message });
  }
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

// ---- Road Route Simulation & Cache ----
const simState = new Map();
const routeCache = new Map();

function buildRouteCacheEntry(route) {
  const roadCoords = route.roadCoordinates && route.roadCoordinates.length >= 2
    ? route.roadCoordinates
    : (route.waypoints || []);

  if (roadCoords.length < 2) return null;

  const segmentLengths = [];
  const cumulativeDistances = [0];
  let totalDist = 0;

  for (let i = 0; i < roadCoords.length - 1; i++) {
    const p1 = roadCoords[i];
    const p2 = roadCoords[i + 1];
    const len = haversineMeters(p1[0], p1[1], p2[0], p2[1]);
    segmentLengths.push(len);
    totalDist += len;
    cumulativeDistances.push(totalDist);
  }

  return {
    roadCoords,
    segmentLengths,
    cumulativeDistances,
    totalDistanceMeters: Math.round(totalDist),
    coordCount: roadCoords.length,
  };
}

function getOrBuildRouteCache(route) {
  let cached = routeCache.get(route.id);
  const currentCount = (route.roadCoordinates && route.roadCoordinates.length) || (route.waypoints && route.waypoints.length) || 0;
  if (!cached || cached.coordCount !== currentCount) {
    cached = buildRouteCacheEntry(route);
    if (cached) {
      routeCache.set(route.id, cached);
    }
  }
  return cached;
}

function getRealisticSpeed(type) {
  switch (type) {
    case 'motorcycle': return 55;
    case 'car': return 60;
    case 'van': return 50;
    case 'truck':
    default:
      return 42;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function formatDuration(sec) {
  if (sec <= 45) return '< 1 min';
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function runSimulationTick() {
  const vehicles = store.getVehicles();
  const routes = store.getRoutes();
  const routesMap = new Map(routes.map(r => [r.id, r]));

  for (const vehicle of vehicles) {
    if (!vehicle.routeId || !routesMap.has(vehicle.routeId)) continue;

    const route = routesMap.get(vehicle.routeId);
    const cachedRoute = getOrBuildRouteCache(route);
    if (!cachedRoute || cachedRoute.roadCoords.length < 2) continue;

    const { roadCoords, segmentLengths, cumulativeDistances, totalDistanceMeters } = cachedRoute;

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

    // Realistic road speed with natural variations
    const currentSpeed = Math.max(15, Math.round(state.speedKmh + (Math.random() * 4 - 2)));

    // Distance in meters traveled in 3 seconds
    const distanceToTravel = (currentSpeed / 3.6) * 3;

    let remainingTravel = distanceToTravel;
    let segIdx = state.segmentIndex;
    let distAlong = state.distanceAlongSegment;

    while (remainingTravel > 0) {
      if (segIdx >= segmentLengths.length) {
        segIdx = 0;
        distAlong = 0;
      }

      const segLen = segmentLengths[segIdx] || 1;
      const spaceLeft = segLen - distAlong;

      if (remainingTravel < spaceLeft) {
        distAlong += remainingTravel;
        remainingTravel = 0;
      } else {
        remainingTravel -= spaceLeft;
        distAlong = 0;
        segIdx++;
        if (segIdx >= segmentLengths.length) {
          segIdx = 0;
        }
      }
    }

    state.segmentIndex = segIdx;
    state.distanceAlongSegment = distAlong;

    // Interpolate exact coordinate along the physical road
    const p1 = roadCoords[segIdx];
    const p2 = roadCoords[segIdx + 1] || p1;
    const segLength = segmentLengths[segIdx] || 1;
    const t = segLength > 0 ? Math.min(1, Math.max(0, distAlong / segLength)) : 0;

    const lat = Number(lerp(p1[0], p2[0], t).toFixed(6));
    const lng = Number(lerp(p1[1], p2[1], t).toFixed(6));
    const timestamp = Date.now();

    // Calculate real road distance and travel time / ETA
    const distanceTraveledMeters = Math.min(totalDistanceMeters, (cumulativeDistances[segIdx] || 0) + distAlong);
    const remainingDistanceMeters = Math.max(0, Math.round(totalDistanceMeters - distanceTraveledMeters));
    const progressPercent = totalDistanceMeters > 0
      ? Math.min(100, Math.max(0, Math.round((distanceTraveledMeters / totalDistanceMeters) * 100)))
      : 0;

    const speedMps = Math.max(currentSpeed, 15) / 3.6;
    const remainingSeconds = Math.round(remainingDistanceMeters / speedMps);
    const etaTimestamp = timestamp + remainingSeconds * 1000;

    const tripMetrics = {
      route_id: route.id,
      route_name: route.name,
      remaining_distance_m: remainingDistanceMeters,
      remaining_distance_km: (remainingDistanceMeters / 1000).toFixed(1),
      total_distance_m: totalDistanceMeters,
      total_distance_km: (totalDistanceMeters / 1000).toFixed(1),
      remaining_seconds: remainingSeconds,
      remaining_time_formatted: formatDuration(remainingSeconds),
      progress_percent: progressPercent,
      eta_time: new Date(etaTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    store.addLocation(vehicle.id, lat, lng, currentSpeed, timestamp, tripMetrics);
    checkGeofences(vehicle.id, lat, lng);

    const payload = {
      vehicle_id: vehicle.id,
      lat,
      lng,
      speed: currentSpeed,
      timestamp,
      ...tripMetrics,
    };
    io.emit('location-update', payload);
  }
}

// Background startup initialization to snap all routes to actual roads via OSRM
async function initRoutesRoadData() {
  const routes = store.getRoutes();
  for (const route of routes) {
    if (!route.roadCoordinates || route.roadCoordinates.length <= (route.waypoints?.length || 0)) {
      if (route.waypoints && route.waypoints.length >= 2) {
        try {
          console.log(`Resolving real road route for "${route.name}" via OSRM...`);
          const roadData = await getRoadRoute(route.waypoints);
          store.updateRouteRoadData(
            route.id,
            roadData.roadCoordinates,
            roadData.distanceMeters,
            roadData.durationSeconds
          );
          routeCache.delete(route.id);
          console.log(`✓ Snapped "${route.name}" to roads (${roadData.roadCoordinates.length} points, ${(roadData.distanceMeters / 1000).toFixed(1)} km)`);
        } catch (err) {
          console.warn(`Failed to resolve road data for ${route.name}:`, err.message);
        }
      }
    }
  }
}

setInterval(runSimulationTick, 3000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Logistics tracker backend running on http://localhost:${PORT}`);
  initRoutesRoadData();
});
