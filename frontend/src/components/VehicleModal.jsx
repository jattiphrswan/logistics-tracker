import { useEffect, useState } from 'react';
import { getRoutes, addVehicle } from '../api';

export default function VehicleModal({ isOpen, onClose, onVehicleAdded }) {
  const [routes, setRoutes] = useState([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('truck');
  const [driver, setDriver] = useState('');
  const [cargo, setCargo] = useState('');
  const [routeId, setRouteId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRoutes();
      // Generate a random vehicle ID by default
      setId('v-' + Math.random().toString(36).substring(2, 7));
      setName('');
      setType('truck');
      setDriver('');
      setCargo('');
      setRouteId('');
      setError('');
    }
  }, [isOpen]);

  async function loadRoutes() {
    try {
      const data = await getRoutes();
      setRoutes(data);
      if (data.length > 0) setRouteId(data[0].id);
    } catch (err) {
      console.error('Failed to load routes in modal:', err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!id.trim() || !name.trim()) {
      setError('Vehicle ID and Name are required.');
      return;
    }
    if (!routeId) {
      setError('Please select or create an assigned route first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await addVehicle({
        id: id.trim(),
        name: name.trim(),
        type,
        routeId,
        cargo: cargo.trim(),
        driver: driver.trim(),
      });
      onVehicleAdded();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add vehicle');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16 }}>Register New Vehicle</h3>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
          {error && <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid var(--red)', padding: 8, borderRadius: 'var(--radius)', textAlign: 'center' }}>{error}</div>}

          <div style={rowStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Vehicle ID</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. truck-404"
                style={inputStyle}
                required
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Friendly Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Express Delhi Cargo"
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={rowStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Vehicle Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
                <option value="truck">🚛 Truck</option>
                <option value="van">🚐 Van</option>
                <option value="car">🚗 Car</option>
                <option value="motorcycle">🏍️ Motorcycle</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Driver Name</label>
              <input
                type="text"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Cargo Manifest ("What is in it")</label>
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="e.g. 50x Laptops, 20x Monitors"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Assigned Route</label>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} style={inputStyle} required>
              {routes.length === 0 ? (
                <option value="">(No routes available - Create one first)</option>
              ) : (
                routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.waypoints.length} pts)</option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={cancelButtonStyle}>Cancel</button>
            <button type="submit" disabled={loading} style={saveButtonStyle}>
              {loading ? 'Registering...' : 'Register & Start Route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalStyle = {
  width: 500,
  maxHeight: '90vh',
  overflowY: 'auto',
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
};

const closeButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: 16,
  cursor: 'pointer',
};

const rowStyle = {
  display: 'flex',
  gap: 12,
};

const fieldStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const labelStyle = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  fontWeight: 500,
};

const inputStyle = {
  padding: '8px 10px',
  background: 'var(--bg-panel-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

const saveButtonStyle = {
  padding: '10px 18px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius)',
  color: '#0f1720',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

const cancelButtonStyle = {
  padding: '10px 18px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-secondary)',
  fontSize: 13,
  cursor: 'pointer',
};
