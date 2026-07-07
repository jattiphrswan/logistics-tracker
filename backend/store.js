// Lightweight JSON-file backed data store. No native modules, so it
// installs and runs identically on Windows/Mac/Linux with just Node.
// Good enough for a demo / starter project; swap for Postgres+PostGIS
// later if you need serious scale or advanced geo queries.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'tracker-data.json');

const DEFAULT_ROUTES = {
  'route-1': {
    id: 'route-1',
    name: 'Delhi - Noida Express',
    waypoints: [
      [28.6139, 77.2090],
      [28.5800, 77.2500],
      [28.5500, 77.2800],
      [28.5300, 77.3200],
      [28.5600, 77.3500],
    ]
  },
  'route-2': {
    id: 'route-2',
    name: 'Gurugram Hub Loop',
    waypoints: [
      [28.4595, 77.0266],
      [28.4750, 77.0500],
      [28.5000, 77.0800],
      [28.5300, 77.1000],
      [28.5000, 77.1200],
      [28.4600, 77.0800],
    ]
  },
  'route-3': {
    id: 'route-3',
    name: 'Connaught Place Circle',
    waypoints: [
      [28.6304, 77.2177],
      [28.6280, 77.2220],
      [28.6250, 77.2200],
      [28.6260, 77.2150],
      [28.6304, 77.2177],
    ]
  }
};

function load() {
  if (!fs.existsSync(FILE)) {
    return {
      vehicles: {},
      locations: [],
      geofences: [
        { id: 1, name: 'Warehouse - Faridabad', lat: 28.4089, lng: 77.3178, radius_m: 500 },
        { id: 2, name: 'Delivery Hub - Delhi', lat: 28.6139, lng: 77.209, radius_m: 800 },
      ],
      geofenceEvents: [],
      nextGeofenceId: 3,
      routes: DEFAULT_ROUTES,
    };
  }
  const parsed = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  if (!parsed.routes || Object.keys(parsed.routes).length === 0) {
    parsed.routes = DEFAULT_ROUTES;
  }
  return parsed;
}

let data = load();
let saveTimer = null;

function save() {
  // debounce writes so rapid location updates don't hammer the disk
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(FILE, JSON.stringify(data));
  }, 200);
}

export function upsertVehicle(id, name, type, routeId = null, cargo = '', driver = '') {
  data.vehicles[id] = {
    id,
    name,
    type: type || 'truck',
    routeId: routeId || null,
    cargo: cargo || '',
    driver: driver || '',
  };
  save();
}

export function getRoutes() {
  return Object.values(data.routes || {});
}

export function addRoute(name, waypoints) {
  const id = 'route-' + (Object.keys(data.routes || {}).length + 1) + '-' + Math.random().toString(36).substring(2, 5);
  if (!data.routes) data.routes = {};
  data.routes[id] = { id, name, waypoints };
  save();
  return id;
}


export function getVehicles() {
  return Object.values(data.vehicles).map((v) => {
    const history = data.locations.filter((l) => l.vehicle_id === v.id);
    const last = history.length ? history[history.length - 1] : null;
    return { ...v, lastLocation: last };
  });
}

export function addLocation(vehicle_id, lat, lng, speed, timestamp) {
  data.locations.push({ vehicle_id, lat, lng, speed: speed || 0, timestamp });
  save();
}

export function getHistory(vehicleId, date) {
  let rows = data.locations.filter((l) => l.vehicle_id === vehicleId);
  if (date) {
    const start = new Date(date + 'T00:00:00').getTime();
    const end = new Date(date + 'T23:59:59').getTime();
    rows = rows.filter((l) => l.timestamp >= start && l.timestamp <= end);
  } else {
    rows = rows.slice(-2000);
  }
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

export function getGeofences() {
  return data.geofences;
}

export function addGeofence(name, lat, lng, radius_m) {
  const id = data.nextGeofenceId++;
  data.geofences.push({ id, name, lat, lng, radius_m });
  save();
  return id;
}

export function addGeofenceEvent(vehicle_id, geofence_id, event, timestamp) {
  data.geofenceEvents.unshift({ vehicle_id, geofence_id, event, timestamp });
  data.geofenceEvents = data.geofenceEvents.slice(0, 200);
  save();
}

export function getGeofenceEvents() {
  return data.geofenceEvents;
}
