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

const startIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      background: #10b981;
      color: white;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      border: 2px solid #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    ">A</div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

const destIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      background: #ef4444;
      color: white;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      border: 2px solid #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    ">B</div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

// Helper to generate styled icons based on vehicle type and state
function getVehicleIcon(type, isMoving, isSelected) {
  const color = isSelected ? '#38bdf8' : isMoving ? 'var(--accent)' : 'var(--text-secondary)';
  const shadowColor = isSelected ? 'rgba(56, 189, 248, 0.6)' : isMoving ? 'rgba(31, 184, 138, 0.47)' : 'rgba(143, 161, 172, 0.3)';
  let iconEmoji = '🚛';
  if (type === 'van') iconEmoji = '🚐';
  else if (type === 'car') iconEmoji = '🚗';
  else if (type === 'motorcycle') iconEmoji = '🏍️';

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: var(--bg-panel);
        border: 2px solid ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px ${shadowColor};
        font-size: 18px;
        position: relative;
        transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
        transition: transform 0.2s;
      ">
        ${iconEmoji}
        <div style="
          width: 9px;
          height: 9px;
          background: ${color};
          border-radius: 50%;
          position: absolute;
          bottom: -1px;
          right: -1px;
          border: 2px solid var(--bg-panel);
        "></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom() < 12 ? 13 : map.getZoom());
  }, [center]);
  return null;
}

export default function MapView({
  vehicles = [],
  geofences = [],
  routes = [],
  selectedId = null,
  onSelectVehicle = null,
  focusCenter = null,
  playbackPosition = null,
  routeGeometry = null,
  etaPoints = null,
  onMapClick = null,
  drawingWaypoints = [],
  isDrawing = false,
}) {
  const selectedVehicle = vehicles.find((v) => v.id === selectedId);
  const selectedRoute = routes.find((r) => r.id === selectedVehicle?.routeId);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={[28.55, 77.27]}
        zoom={11}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          className="dark-tiles"
        />

        {/* Geofences */}
        {geofences.map((z) => (
          <Circle
            key={z.id}
            center={[z.lat, z.lng]}
            radius={z.radius_m}
            pathOptions={{ color: '#e0a835', fillColor: '#e0a835', fillOpacity: 0.08, weight: 1.5 }}
          >
            <Popup>
              <div style={{ fontWeight: 600 }}>📍 {z.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Radius: {z.radius_m}m</div>
            </Popup>
          </Circle>
        ))}

        {/* Render Road Routes on Live Map */}
        {!isDrawing && routes.map((r) => {
          const coords = r.roadCoordinates && r.roadCoordinates.length >= 2
            ? r.roadCoordinates
            : r.waypoints;

          if (!coords || coords.length < 2) return null;

          const isSelected = selectedVehicle && selectedVehicle.routeId === r.id;

          return (
            <Polyline
              key={r.id}
              positions={coords}
              pathOptions={{
                color: isSelected ? '#00e5a3' : '#38bdf8',
                weight: isSelected ? 5 : 3,
                opacity: isSelected ? 0.95 : 0.4,
                dashArray: isSelected ? null : '6, 8',
              }}
            />
          );
        })}

        {/* Start (A) and Destination (B) Markers for Selected Route */}
        {selectedRoute && (selectedRoute.roadCoordinates || selectedRoute.waypoints)?.length >= 2 && (
          <>
            <Marker
              position={(selectedRoute.roadCoordinates || selectedRoute.waypoints)[0]}
              icon={startIcon}
            >
              <Popup>
                <div style={{ fontWeight: 600, color: '#10b981' }}>🟢 Route Start (A)</div>
                <div style={{ fontSize: 12 }}>{selectedRoute.name}</div>
              </Popup>
            </Marker>
            <Marker
              position={(selectedRoute.roadCoordinates || selectedRoute.waypoints)[(selectedRoute.roadCoordinates || selectedRoute.waypoints).length - 1]}
              icon={destIcon}
            >
              <Popup>
                <div style={{ fontWeight: 600, color: '#ef4444' }}>🏁 Destination (B)</div>
                <div style={{ fontSize: 12 }}>{selectedRoute.name}</div>
                {selectedRoute.distanceMeters && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Total Road Distance: {(selectedRoute.distanceMeters / 1000).toFixed(1)} km
                  </div>
                )}
              </Popup>
            </Marker>
          </>
        )}

        {/* Render vehicles with custom type icons and road trip details */}
        {!isDrawing && vehicles
          .filter((v) => v.lastLocation)
          .map((v) => {
            const loc = v.lastLocation;
            const speed = loc.speed ?? 0;
            const isMoving = speed > 2;
            const isSelected = v.id === selectedId;

            return (
              <Marker
                key={v.id}
                position={[loc.lat, loc.lng]}
                icon={getVehicleIcon(v.type, isMoving, isSelected)}
                eventHandlers={{
                  click: () => onSelectVehicle && onSelectVehicle(v.id),
                }}
              >
                <Popup>
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{v.name}</span>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isMoving ? 'var(--accent-dim)' : 'rgba(255,255,255,0.1)',
                        color: isMoving ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: 600,
                      }}>
                        {isMoving ? 'MOVING ON ROAD' : 'STOPPED'}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      👤 Driver: <b>{v.driver || 'Unassigned'}</b> · 📦 Cargo: {v.cargo || 'Empty'}
                    </div>

                    <div style={{
                      background: 'rgba(255,255,255,0.05)',
                      padding: '8px 10px',
                      borderRadius: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      marginTop: 2,
                    }}>
                      <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>
                        🛣️ {v.route?.name || loc.route_name || 'Assigned Route'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>📍 Road Distance Left:</span>
                        <b>{loc.remaining_distance_km ? `${loc.remaining_distance_km} km` : '--'}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>⏱️ Estimated Travel Time:</span>
                        <b style={{ color: 'var(--accent)' }}>{loc.remaining_time_formatted || '--'}</b>
                      </div>
                      {loc.eta_time && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span>🏁 Expected Arrival:</span>
                          <b>{loc.eta_time}</b>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>⚡ Current Speed:</span>
                        <b>{Math.round(speed)} km/h</b>
                      </div>

                      {/* Progress Bar */}
                      {loc.progress_percent != null && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                            <span>Route Progress</span>
                            <span>{loc.progress_percent}%</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                            <div style={{
                              width: `${loc.progress_percent}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #1fb88a, #00f0ff)',
                            }} />
                          </div>
                        </div>
                      )}
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
            pathOptions={{ color: '#1fb88a', weight: 5, opacity: 0.9 }}
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

      {/* Floating Live Trip HUD Card for Selected Vehicle */}
      {selectedVehicle && selectedVehicle.lastLocation && (
        <div style={hudCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>
                  {selectedVehicle.type === 'van' ? '🚐' : selectedVehicle.type === 'car' ? '🚗' : selectedVehicle.type === 'motorcycle' ? '🏍️' : '🚛'}
                </span>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  {selectedVehicle.name}
                </span>
                <span style={livePulseBadgeStyle}>
                  LIVE ROAD TRACKING
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Driver: <b>{selectedVehicle.driver || 'Unassigned'}</b> · Route: <b style={{ color: '#38bdf8' }}>{selectedVehicle.route?.name || selectedVehicle.lastLocation.route_name || 'Active Loop'}</b>
              </div>
            </div>

            <button
              onClick={() => onSelectVehicle && onSelectVehicle(null)}
              style={closeButtonStyle}
              title="Close HUD"
            >
              ✕
            </button>
          </div>

          {/* 3 Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
            <div style={metricBoxStyle}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 Road Distance Left</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
                {selectedVehicle.lastLocation.remaining_distance_km ? `${selectedVehicle.lastLocation.remaining_distance_km} km` : '--'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                Total: {selectedVehicle.lastLocation.total_distance_km ? `${selectedVehicle.lastLocation.total_distance_km} km` : '--'}
              </div>
            </div>

            <div style={metricBoxStyle}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱️ Time to Destination</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                {selectedVehicle.lastLocation.remaining_time_formatted || '--'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                Speed: {Math.round(selectedVehicle.lastLocation.speed || 0)} km/h
              </div>
            </div>

            <div style={metricBoxStyle}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏁 Arrival ETA</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e0a835', marginTop: 2 }}>
                {selectedVehicle.lastLocation.eta_time || '--'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                Progress: {selectedVehicle.lastLocation.progress_percent ?? 0}%
              </div>
            </div>
          </div>

          {/* Progress Bar along Route */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <span>Route Road Progress</span>
              <span><b>{selectedVehicle.lastLocation.progress_percent ?? 0}%</b></span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${selectedVehicle.lastLocation.progress_percent ?? 0}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #1fb88a 0%, #00f0ff 100%)',
                  boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
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

const hudCardStyle = {
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  background: 'rgba(22, 33, 44, 0.92)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(56, 189, 248, 0.3)',
  borderRadius: 12,
  padding: '14px 18px',
  width: '90%',
  maxWidth: 580,
  boxShadow: '0 12px 36px rgba(0,0,0,0.5), 0 0 20px rgba(56, 189, 248, 0.15)',
};

const metricBoxStyle = {
  background: 'rgba(0, 0, 0, 0.25)',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.05)',
};

const livePulseBadgeStyle = {
  fontSize: 10,
  fontWeight: 700,
  color: '#00e5a3',
  background: 'rgba(0, 229, 163, 0.15)',
  padding: '3px 8px',
  borderRadius: 20,
  border: '1px solid rgba(0, 229, 163, 0.3)',
  letterSpacing: 0.5,
};

const closeButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: 16,
  cursor: 'pointer',
  padding: '2px 6px',
};
