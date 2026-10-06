import { useState } from 'react';

export default function VehicleList({ vehicles, selectedId, onSelect, onAddClick }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = vehicles.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(query.toLowerCase()) ||
      v.id.toLowerCase().includes(query.toLowerCase()) ||
      (v.driver && v.driver.toLowerCase().includes(query.toLowerCase()));

    const matchesType = typeFilter === 'all' || v.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const getEmoji = (type) => {
    switch (type) {
      case 'van': return '🚐';
      case 'car': return '🚗';
      case 'motorcycle': return '🏍️';
      case 'truck':
      default:
        return '🚛';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search and Filters */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, ID, driver..."
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Types</option>
            <option value="truck">🚛 Trucks</option>
            <option value="van">🚐 Vans</option>
            <option value="car">🚗 Cars</option>
            <option value="motorcycle">🏍️ Motorcycles</option>
          </select>
          <button onClick={onAddClick} style={addButtonStyle}>
            ➕ Add Vehicle
          </button>
        </div>
      </div>

      {/* Vehicle Cards List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {filtered.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 8px', textAlign: 'center' }}>
            No vehicles match filter.
          </div>
        )}
        {filtered.map((v) => {
          const isSelected = v.id === selectedId;
          const speed = v.lastLocation?.speed ?? 0;
          const isMoving = speed > 2;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                marginBottom: 6,
                background: isSelected ? 'var(--accent-dim)' : 'var(--bg-panel-raised)',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-primary)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{getEmoji(v.type)}</span>
                  <span>{v.name}</span>
                </span>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isMoving ? 'var(--accent)' : 'var(--text-muted)',
                    boxShadow: isMoving ? '0 0 8px var(--accent)' : 'none',
                  }}
                />
              </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>ID: {v.id}</span>
                {v.driver && <span>👤 {v.driver}</span>}
              </div>

              {v.cargo && (
                <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  📦 {v.cargo}
                </div>
              )}

              {/* Road Route & Distance / ETA Badges */}
              {(v.route?.name || v.lastLocation?.route_name) && (
                <div style={{
                  fontSize: 11,
                  color: '#38bdf8',
                  marginTop: 6,
                  background: 'rgba(56, 189, 248, 0.08)',
                  padding: '3px 6px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  🛣️ {v.route?.name || v.lastLocation?.route_name}
                </div>
              )}

              {v.lastLocation?.remaining_distance_km != null && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  marginTop: 6,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}>
                  <span style={{ color: 'var(--accent)' }}>
                    📍 {v.lastLocation.remaining_distance_km} km left
                  </span>
                  <span style={{ color: '#e0a835' }}>
                    ⏱️ {v.lastLocation.remaining_time_formatted || '--'}
                  </span>
                </div>
              )}

              {/* Road Progress Bar */}
              {v.lastLocation?.progress_percent != null && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${v.lastLocation.progress_percent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #1fb88a, #00f0ff)',
                    }} />
                  </div>
                </div>
              )}

              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6, fontFamily: 'var(--font-mono)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {v.lastLocation
                    ? `${v.lastLocation.lat.toFixed(4)}, ${v.lastLocation.lng.toFixed(4)}`
                    : 'No location yet'}
                </span>
                <span>{Math.round(speed)} km/h</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg-panel-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

const selectStyle = {
  flex: 1,
  padding: '6px 8px',
  background: 'var(--bg-panel-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
};

const addButtonStyle = {
  padding: '6px 12px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius)',
  color: '#0f1720',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
