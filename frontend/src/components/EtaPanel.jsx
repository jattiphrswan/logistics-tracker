import { useState } from 'react';
import { getEta } from '../api';

export default function EtaPanel({ points, setPoints, onRoute }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function calculate() {
    if (!points.from || !points.to) return;
    setLoading(true);
    setError('');
    try {
      const data = await getEta(points.from, points.to);
      setResult(data);
      onRoute(data.geometry);
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Click the map to set a start point, click again for the destination.
      </div>
      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
        From: {points.from ? `${points.from.lat.toFixed(4)}, ${points.from.lng.toFixed(4)}` : '—'}
        <br />
        To: {points.to ? `${points.to.lat.toFixed(4)}, ${points.to.lng.toFixed(4)}` : '—'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={calculate} disabled={!points.from || !points.to || loading} style={buttonStyle}>
          {loading ? 'Calculating...' : 'Get ETA'}
        </button>
        <button onClick={() => { setPoints({ from: null, to: null }); setResult(null); onRoute(null); }} style={buttonStyleGhost}>
          Clear
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--red)' }}>
          {error} (the public OSRM demo server can be flaky — try again in a moment)
        </div>
      )}

      {result && (
        <div style={{ background: 'var(--bg-panel-raised)', borderRadius: 'var(--radius)', padding: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>
            {Math.round(result.durationSeconds / 60)} min
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {(result.distanceMeters / 1000).toFixed(1)} km by road
          </div>
        </div>
      )}
    </div>
  );
}

const buttonStyle = {
  padding: '8px 14px',
  background: 'var(--accent-dim)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius)',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 500,
};

const buttonStyleGhost = {
  padding: '8px 14px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-secondary)',
  fontSize: 13,
};
