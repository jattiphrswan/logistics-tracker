import { useState } from 'react';
import { login } from '../api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const token = await login(username, password);
      onLoginSuccess(token);
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoStyle}>🌍</div>
          <h2 style={titleStyle}>Antigravity Logistics</h2>
          <p style={subtitleStyle}>Fleet Management & Tracking System</p>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          {error && <div style={errorStyle}>{error}</div>}

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={inputStyle}
            />
          </div>

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div style={footerStyle}>
          Demo credentials: <span style={{ color: 'var(--text-primary)' }}>admin</span> / <span style={{ color: 'var(--text-primary)' }}>admin123</span>
        </div>
      </div>
    </div>
  );
}

const containerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100vw',
  height: '100vh',
  background: 'radial-gradient(circle at center, #16212c 0%, #0f1720 100%)',
};

const cardStyle = {
  width: 380,
  padding: '40px 32px',
  background: 'rgba(22, 33, 44, 0.75)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.47)',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const headerStyle = {
  textAlign: 'center',
};

const logoStyle = {
  fontSize: 42,
  marginBottom: 12,
};

const titleStyle = {
  fontSize: 22,
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: 0,
};

const subtitleStyle = {
  fontSize: 13,
  color: 'var(--text-muted)',
  margin: '6px 0 0',
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const errorStyle = {
  background: 'var(--red-dim)',
  border: '1px solid var(--red)',
  color: 'var(--red)',
  padding: '10px 12px',
  borderRadius: 'var(--radius)',
  fontSize: 13,
  textAlign: 'center',
};

const inputGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const labelStyle = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  fontWeight: 500,
};

const inputStyle = {
  padding: '10px 14px',
  background: 'var(--bg-panel-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s',
};

const buttonStyle = {
  marginTop: 8,
  padding: '12px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius)',
  color: '#0f1720',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const footerStyle = {
  fontSize: 12,
  color: 'var(--text-muted)',
  textAlign: 'center',
  marginTop: 8,
};
