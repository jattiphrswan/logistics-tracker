import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

// Fix default marker icons not loading under Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const playbackIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#1fb88a;border:2px solid white;box-shadow:0 0 0 4px rgba(31,184,138,0.3)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Helper to generate styled icons based on vehicle type and state
function getVehicleIcon(type, isMoving) {
  const color = isMoving ? 'var(--accent)' : 'var(--text-secondary)';
  const shadowColor = isMoving ? 'rgba(31, 184, 138, 0.47)' : 'rgba(143, 161, 172, 0.3)';
  let iconEmoji = '🚛';
  if (type === 'van') iconEmoji = '🚐';
  else if (type === 'car') iconEmoji = '🚗';
  else if (type === 'motorcycle') iconEmoji = '🏍️';

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: var(--bg-panel);
        border: 2px solid ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px ${shadowColor};
        font-size: 16px;
        position: relative;
      ">
        ${iconEmoji}
        <div style="
          width: 8px;
          height: 8px;
          background: ${color};
          border-radius: 50%;
          position: absolute;
          bottom: -1px;
          right: -1px;
          border: 1px solid var(--bg-panel);
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom() < 10 ? 12 : map.getZoom());
  }, [center]);
  return null;
}

export default function MapView({
  vehicles,
  geofences,
  focusCenter,
  playbackPosition,
  routeGeometry,
  etaPoints,
  onMapClick,
  drawingWaypoints = [], // Dynamic drawing waypoints
  isDrawing = false,
}) {
  return (
    <MapContainer
      center={[28.55, 77.27]}
      zoom={11}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
      />

      {geofences.map((z) => (
        <Circle
          key={z.id}
          center={[z.lat, z.lng]}
          radius={z.radius_m}
          pathOptions={{ color: '#e0a835', fillColor: '#e0a835', fillOpacity: 0.06, weight: 1 }}
        >
          <Popup>{z.name}</Popup>
        </Circle>
      ))}

      {/* Render vehicles with custom type icons */}
      {!isDrawing && vehicles
        .filter((v) => v.lastLocation)
        .map((v) => {
          const speed = v.lastLocation.speed ?? 0;
          const isMoving = speed > 2;
          return (
            <Marker
              key={v.id}
              position={[v.lastLocation.lat, v.lastLocation.lng]}
              icon={getVehicleIcon(v.type, isMoving)}
            >
              <Popup>
                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: {v.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Type: {v.type?.toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Driver: {v.driver || 'Unassigned'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Cargo: {v.cargo || 'Empty'}</div>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--accent)', marginTop: 4 }}>
                    Speed: {Math.round(speed)} km/h
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

      {playbackPosition && (
        <Marker position={[playbackPosition.lat, playbackPosition.lng]} icon={playbackIcon} />
      )}

      {/* Render general route lines (playback or ETA) */}
      {routeGeometry && (
        <Polyline
          positions={routeGeometry.coordinates.map(([lng, lat]) => [lat, lng])}
          pathOptions={{ color: '#1fb88a', weight: 4, opacity: 0.85 }}
        />
      )}

      {/* Render route creation waypoints dynamically */}
      {isDrawing && drawingWaypoints.length > 0 && (
        <>
          <Polyline
            positions={drawingWaypoints}
            pathOptions={{ color: '#e0a835', weight: 3, dashArray: '5, 5' }}
          />
          {drawingWaypoints.map((pt, idx) => (
            <Circle
              key={idx}
              center={pt}
              radius={80}
              pathOptions={{ color: '#e0a835', fillColor: '#e0a835', fillOpacity: 0.8 }}
            />
          ))}
        </>
      )}

      {etaPoints?.from && <Marker position={[etaPoints.from.lat, etaPoints.from.lng]} />}
      {etaPoints?.to && <Marker position={[etaPoints.to.lat, etaPoints.to.lng]} />}

      {focusCenter && <Recenter center={focusCenter} />}
      <ClickCapture onMapClick={onMapClick} />
    </MapContainer>
  );
}

function ClickCapture({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (!onMapClick) return;
    const handler = (e) => onMapClick(e.latlng);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onMapClick]);
  return null;
}
