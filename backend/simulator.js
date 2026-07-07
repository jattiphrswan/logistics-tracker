// Simulates vehicle movements along their assigned routes in real-time.
// Reads vehicles and routes directly from tracker-data.json so it matches the DB state.
// Calculates realistic speeds and updates position incrementally.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'tracker-data.json');
const API_URL = 'http://localhost:4000/api/location';

// Keep track of simulator state in memory
// vehicleId -> { routeId, segmentIndex, distanceAlongSegment }
const simState = new Map();

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Loads active database state
function loadData() {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (err) {
    console.error('Error reading database file:', err.message);
    return null;
  }
}

async function simulateTick() {
  const data = loadData();
  if (!data || !data.vehicles) return;

  const vehicles = Object.values(data.vehicles);
  const routes = data.routes || {};

  for (const vehicle of vehicles) {
    // Only simulate if vehicle has an assigned route
    if (!vehicle.routeId || !routes[vehicle.routeId]) continue;

    const route = routes[vehicle.routeId];
    const waypoints = route.waypoints;
    if (!waypoints || waypoints.length < 2) continue;

    // Get or initialize state for this vehicle
    let state = simState.get(vehicle.id);
    if (!state || state.routeId !== vehicle.routeId) {
      state = {
        routeId: vehicle.routeId,
        segmentIndex: 0,
        distanceAlongSegment: 0,
        // Assign a realistic speed based on type (km/h)
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

    // Save back to state
    state.segmentIndex = segIdx;
    state.distanceAlongSegment = distAlong;

    // Calculate actual coordinate
    const p1 = waypoints[segIdx];
    const p2 = waypoints[(segIdx + 1) % waypoints.length];
    const segLength = haversineMeters(p1[0], p1[1], p2[0], p2[1]);
    const t = segLength > 0 ? distAlong / segLength : 0;

    const lat = lerp(p1[0], p2[0], t);
    const lng = lerp(p1[1], p2[1], t);

    // POST location to server
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicle.id,
          lat,
          lng,
          speed: currentSpeed,
        }),
      });
      if (!response.ok) {
        console.error(`Post failed for ${vehicle.id}: status ${response.status}`);
      }
    } catch (err) {
      console.error(`Network error posting location for ${vehicle.id}:`, err.message);
    }
  }
}

function getRealisticSpeed(type) {
  switch (type) {
    case 'motorcycle':
      return 55;
    case 'car':
      return 60;
    case 'van':
      return 50;
    case 'truck':
    default:
      return 40;
  }
}

async function main() {
  console.log('Vehicle simulator started.');
  console.log('Calculating positions based on actual speeds every 3s.');
  console.log('Reading dynamic routes and vehicles from tracker-data.json...');
  console.log('Ctrl+C to stop.');

  // Run immediately and then every 3s
  simulateTick();
  setInterval(simulateTick, 3000);
}

main();
