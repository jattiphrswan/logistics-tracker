import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getVehicles, getGeofences, logout, API_BASE } from './api';
import VehicleList from './components/VehicleList';
import AlertFeed from './components/AlertFeed';
import MapView from './components/MapView';
import PlaybackPanel from './components/PlaybackPanel';
import EtaPanel from './components/EtaPanel';
import RouteManager from './components/RouteManager';
import VehicleModal from './components/VehicleModal';
import Login from './components/Login';

const TABS = [
  { id: 'live', label: 'Live map' },
  { id: 'routes', label: 'Route manager' },
  { id: 'playback', label: 'Route playback' },
  { id: 'eta', label: 'ETA planner' },
];

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [vehicles, setVehicles] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [tab, setTab] = useState('live');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Route Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingWaypoints, setDrawingWaypoints] = useState([]);

  const [playbackPosition, setPlaybackPosition] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [etaPoints, setEtaPoints] = useState({ from: null, to: null });

  // Refresh lists helper
  const refreshData = () => {
    if (!token) return;
    getVehicles().then(setVehicles).catch(() => handleLogout());
    getGeofences().then(setGeofences).catch(() => {});
  };

  useEffect(() => {
    if (!token) return;

    refreshData();

    // Secure socket connection by passing auth token
    const socket = io(API_BASE, {
      auth: { token },
    });

    socket.on('location-update', (payload) => {
      setVehicles((prev) => {
        const exists = prev.some((v) => v.id === payload.vehicle_id);
        if (!exists) {
          getVehicles().then(setVehicles).catch(() => {});
          return prev;
        }
        return prev.map((v) =>
          v.id === payload.vehicle_id ? { ...v, lastLocation: payload } : v
        );
      });
    });

    socket.on('geofence-alert', (payload) => {
      setAlerts((prev) => [payload, ...prev].slice(0, 50));
    });

    return () => socket.disconnect();
  }, [token]);

  // Reset drawing / playback geometries when tabs change
  useEffect(() => {
    setIsDrawing(false);
    setDrawingWaypoints([]);
    setRouteGeometry(null);
    setPlaybackPosition(null);
  }, [tab]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedId);
  const focusCenter = selectedVehicle?.lastLocation
    ? [selectedVehicle.lastLocation.lat, selectedVehicle.lastLocation.lng]
    : null;

  async function handleLogout() {
    await logout();
    setToken(null);
  }

  function handleMapClick(latlng) {
    if (tab === 'eta') {
      setEtaPoints((prev) => {
        if (!prev.from) return { ...prev, from: latlng };
        if (!prev.to) return { ...prev, to: latlng };
        return { from: latlng, to: null };
      });
    } else if (tab === 'routes' && isDrawing) {
      setDrawingWaypoints((prev) => [...prev, [latlng.lat, latlng.lng]]);
    }
  }

  // Render login screen if unauthenticated
  if (!token) {
    return <Login onLoginSuccess={(tok) => setToken(tok)} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: 300,
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Fleet tracker</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{vehicles.length} vehicles</div>
          </div>
          <button onClick={handleLogout} style={logoutButtonStyle}>Logout</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <VehicleList
            vehicles={vehicles}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddClick={() => setIsModalOpen(true)}
          />
        </div>
        <AlertFeed alerts={alerts} />
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: 1 }}>
            <MapView
              vehicles={vehicles}
              geofences={geofences}
              focusCenter={tab === 'live' ? focusCenter : null}
              playbackPosition={tab === 'playback' ? playbackPosition : null}
              routeGeometry={tab !== 'live' ? routeGeometry : null}
              etaPoints={tab === 'eta' ? etaPoints : null}
              onMapClick={handleMapClick}
              drawingWaypoints={drawingWaypoints}
              isDrawing={tab === 'routes' && isDrawing}
            />
          </div>

          {tab === 'routes' && (
            <div style={{ width: 320, borderLeft: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <RouteManager
                isDrawing={isDrawing}
                setIsDrawing={setIsDrawing}
                waypoints={drawingWaypoints}
                setWaypoints={setDrawingWaypoints}
                onRouteSaved={refreshData}
              />
            </div>
          )}

          {tab === 'playback' && (
            <div style={{ width: 320, borderLeft: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <PlaybackPanel
                vehicles={vehicles}
                onPositionChange={setPlaybackPosition}
                onRouteChange={setRouteGeometry}
              />
            </div>
          )}

          {tab === 'eta' && (
            <div style={{ width: 320, borderLeft: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <EtaPanel points={etaPoints} setPoints={setEtaPoints} onRoute={setRouteGeometry} />
            </div>
          )}
        </div>
      </main>

      <VehicleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onVehicleAdded={refreshData}
      />
    </div>
  );
}

const logoutButtonStyle = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'border-color 0.2s, color 0.2s',
};
