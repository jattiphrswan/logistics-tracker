import { useEffect, useState } from 'react';
import { getRoutes, addRoute } from '../api';

export default function RouteManager({
  isDrawing,
  setIsDrawing,
  waypoints,
  setWaypoints,
  onRouteSaved,
}) {
  const [routes, setRoutes] = useState([]);
  const [routeName, setRouteName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, []);

  async function loadRoutes() {
    try {
      const data = await getRoutes();
      setRoutes(data);
    } catch (err) {
      console.error('Failed to load routes:', err.message);
    }
  }

  async function handleSave() {
    if (!routeName.trim()) {
      setError('Please enter a route name.');
      return;
    }
    if (waypoints.length < 2) {
      setError('Please click on the map to add at least 2 waypoints.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await addRoute(routeName, waypoints);
      setRouteName('');
      setWaypoints([]);
      setIsDrawing(false);
      await loadRoutes();
      if (onRouteSaved) onRouteSaved();
    } catch (err) {
      setError(err.message || 'Failed to save route');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setIsDrawing(false);
    setRouteName('');
    setWaypoints([]);
    setError('');
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        Route Manager
      </div>

      {!isDrawing ? (
        <>
          <button
            onClick={() => {
              setIsDrawing(true);
              setWaypoints([]);
              setRouteName('');
              setError('');
            }}
            style={actionButtonStyle}
          >
            ➕ Draw New Route
          </button>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
              Available Routes ({routes.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {routes.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No routes saved yet.</div>
              ) : (
                routes.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--bg-panel-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>🛣️ {r.distanceMeters ? `${(r.distanceMeters / 1000).toFixed(1)} km` : `${r.waypoints?.length || 0} pts`}</span>
                      {r.durationSeconds && <span>⏱️ ~{Math.round(r.durationSeconds / 60)} mins</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      {r.roadCoordinates ? `${r.roadCoordinates.length} road coordinates (snapped)` : `${r.waypoints?.length || 0} waypoints`} · {r.id}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-panel-raised)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
            Drawing Mode Active
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Click waypoints on the map. The system will automatically snap to the shortest road route and calculate real road distance & driving duration.
          </div>

          {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Route Name</label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g. Noida Express Corridor"
              style={inputStyle}
            />
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Points placed:</span>
            <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{waypoints.length}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={loading || waypoints.length < 2 || !routeName.trim()}
              style={saveButtonStyle}
            >
              {loading ? 'Snapping to road...' : 'Save Road Route'}
            </button>
            <button
              onClick={handleCancel}
              style={cancelButtonStyle}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

const actionButtonStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius)',
  color: '#0f1720',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const saveButtonStyle = {
  flex: 1,
  padding: '8px 12px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius)',
  color: '#0f1720',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const cancelButtonStyle = {
  padding: '8px 12px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  cursor: 'pointer',
};
