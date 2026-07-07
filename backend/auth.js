// In-memory session manager for login/logout and API protection
const sessions = new Map();

// Default admin credentials
const ADMIN_USER = {
  username: 'admin',
  password: 'admin123',
};

// Generates a simple random session token
function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function login(username, password) {
  const cleanUser = (username || '').trim();
  const cleanPass = (password || '').trim();
  if (cleanUser === ADMIN_USER.username && cleanPass === ADMIN_USER.password) {
    const token = generateToken();
    sessions.set(token, {
      username: cleanUser,
      createdAt: Date.now(),
    });
    return token;
  }
  return null;
}

export function logout(token) {
  if (sessions.has(token)) {
    sessions.delete(token);
    return true;
  }
  return false;
}

export function isValidSession(token) {
  if (!token) return false;
  return sessions.has(token);
}

// Express middleware to protect API routes
export function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || !isValidSession(token)) {
    return res.status(401).json({ error: 'Unauthorized or expired session' });
  }

  next();
}
