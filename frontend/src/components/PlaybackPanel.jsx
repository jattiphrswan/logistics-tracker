import { useEffect, useRef, useState } from 'react';
import { getHistory } from '../api';

export default function PlaybackPanel({ vehicles, onPositionChange, onRouteChange }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [points, setPoints] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (vehicles.length && !vehicleId) setVehicleId(vehicles[0].id);
  }, [vehicles]);

  async function loadHistory() {
    if (!vehicleId) return;
    const rows = await getHistory(vehicleId, date);
    setPoints(rows);
    setIndex(0);
    onRouteChange(
      rows.length
        ? { type: 'LineString', coordinates: rows.map((p) => [p.lng, p.lat]) }
        : null
    );
  }

  useEffect(() => {
    if (points[index]) onPositionChange(points[index]);
  }, [index, points]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setIndex((i) => {
          if (i >= points.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 400);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, points.length]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          style={selectStyle}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={selectStyle}
        />
        <button onClick={loadHistory} style={buttonStyle}>Load</button>
      </div>

      {points.length > 0 ? (
        <>
          <input
            type="range"
            min={0}
            max={points.length - 1}
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setPlaying((p) => !p)} style={buttonStyle}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {new Date(points[index].timestamp).toLocaleTimeString()} · point {index + 1}/{points.length}
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Pick a vehicle and date, then Load to replay its route.
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  flex: 1,
  padding: '8px 10px',
  background: 'var(--bg-panel-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  fontSize: 13,
};

const buttonStyle = {
  padding: '8px 14px',
  background: 'var(--accent-dim)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius)',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 500,
};
