export default function AlertFeed({ alerts }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', maxHeight: 220, overflowY: 'auto' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Geofence alerts
      </div>
      {alerts.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No alerts yet.</div>
      )}
      {alerts.map((a, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 8,
            padding: '6px 0',
            fontSize: 13,
            borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span
            style={{
              color: a.event === 'enter' ? 'var(--accent)' : 'var(--amber)',
              fontWeight: 500,
              minWidth: 44,
            }}
          >
            {a.event === 'enter' ? 'IN' : 'OUT'}
          </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {a.vehicleId} — {a.zoneName}
          </span>
        </div>
      ))}
    </div>
  );
}
