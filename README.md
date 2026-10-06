# Logistics / fleet tracker — starter project

A working starter for a vehicle/parcel tracking web app: live map, geofencing
alerts, route history playback, and ETA lookup.

## What's inside

```
logistics-tracker/
├── backend/          Node + Express + Socket.io API and JSON data store
│   ├── server.js      All REST endpoints + geofence check + Socket.io
│   ├── store.js        Data storage (plain JSON file, no native deps)
│   └── simulator.js    Fakes 2 moving vehicles for testing
└── frontend/          React + Vite + Leaflet dashboard
    └── src/
        ├── App.jsx              Layout + tabs + live socket connection
        └── components/
            ├── VehicleList.jsx   Sidebar list, search/filter
            ├── AlertFeed.jsx     Geofence enter/exit alerts
            ├── MapView.jsx       Leaflet map (markers, zones, routes)
            ├── PlaybackPanel.jsx Route history replay
            └── EtaPanel.jsx      Click-to-route ETA lookup
```

## 1. Run the backend

```bash
cd backend
npm install
npm start
```

You should see `Logistics tracker backend running on http://localhost:4000`.

This starts the API and a WebSocket server. It comes pre-seeded with two demo
geofences (a warehouse and a delivery hub) so you can see alerts fire right away.

## 2. Feed it some vehicle data

You have two options — use both if you like:

**Option A — simulator (fastest way to see everything work):**
```bash
cd backend
npm run simulate
```
This creates two fake vehicles and moves them along preset routes, posting
their location every 3 seconds. Watch the backend terminal log `[geofence]`
lines as they cross zone boundaries.

**Option B — real devices:** point your GPS hardware, or a small script on a
driver's phone, at:
```
POST http://localhost:4000/api/location
Content-Type: application/json

{ "vehicle_id": "truck-1", "lat": 28.61, "lng": 77.20, "speed": 35 }
```
Register the vehicle's display name once with:
```
POST http://localhost:4000/api/vehicles
{ "id": "truck-1", "name": "Truck 1" }
```

## 3. Run the dashboard

```bash
cd frontend
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). You'll see:

- **Live map tab** — vehicles moving in real time, geofence circles drawn,
  alerts streaming into the sidebar as vehicles enter/exit zones.
- **Route playback tab** — pick a vehicle and a date, then scrub the slider
  or hit Play to replay its path for that day.
- **ETA planner tab** — click two points on the map (start, then destination)
  and get a driving ETA + distance, with the route drawn on the map.

## How each feature works

- **Geofencing**: on every location update, the backend checks the vehicle's
  distance to each stored zone (haversine formula) and compares it to the
  previous check. A crossing fires a `geofence-alert` event over the socket
  and is logged to the events list.
- **Route history**: every location update is also just appended to the
  history log, keyed by vehicle + timestamp — that's what playback replays.
- **ETA**: the backend proxies to the free public OSRM demo routing server
  (`router.project-osrm.org`). It returns driving duration, distance, and the
  route geometry.
- **Fleet view**: the sidebar list + map are just two views over the same
  `vehicles` state, kept in sync by the same socket connection.

## Where to go from here

- **Swap the data store**: `backend/store.js` is a plain JSON file so it
  installs with zero native dependencies. For production scale, swap it for
  PostgreSQL + PostGIS (`ST_DWithin` makes geofencing a one-line SQL query)
  or MongoDB with a geospatial index.
- **Self-host OSRM**: the public demo server is rate-limited and not for
  production use. Run your own OSRM instance with Docker for reliable ETAs.
- **Add auth**: right now anything can post a location update. Add an API
  key per vehicle before exposing this beyond your local network.
- **Polygon geofences**: current zones are circles (center + radius). For
  irregular shapes (a warehouse lot, a delivery district), store a GeoJSON
  polygon and use a point-in-polygon check (e.g. the `turf.js` library) instead
  of the haversine distance check.
- **Push notifications**: right now alerts only show while the dashboard is
  open. Wire the `geofence-alert` event to email/SMS/push for real alerting.

## Opening this in VS Code

1. Open the `logistics-tracker` folder in VS Code (`File > Open Folder`).
2. Open two terminals (`` Ctrl+` ``, then the `+` icon): one for
   `backend`, one for `frontend`, and run the commands above in each.
3. Edit any file — both the backend (with `node --watch`, or just restart it)
   and the frontend (Vite hot-reloads automatically) will reflect your changes.
