export const API_BASE = 'https://logistics-tracker-api-rbq7.onrender.com';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export async function login(username, password) {
  const r = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || 'Invalid credentials');
  }
  const data = await r.json();
  localStorage.setItem('token', data.token);
  return data.token;
}

export async function logout() {
  try {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      headers: getHeaders(),
    });
  } catch (err) {
    console.error('Logout error:', err.message);
  } finally {
    localStorage.removeItem('token');
  }
}

export async function getVehicles() {
  const r = await fetch(`${API_BASE}/api/vehicles`, { headers: getHeaders() });
  if (r.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
  }
  return r.json();
}

export async function addVehicle(vehicle) {
  const r = await fetch(`${API_BASE}/api/vehicles`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(vehicle),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || 'Failed to save vehicle');
  }
  return r.json();
}

export async function getRoutes() {
  const r = await fetch(`${API_BASE}/api/routes`, { headers: getHeaders() });
  return r.json();
}

export async function addRoute(name, waypoints) {
  const r = await fetch(`${API_BASE}/api/routes`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, waypoints }),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || 'Failed to create route');
  }
  return r.json();
}

export async function getGeofences() {
  const r = await fetch(`${API_BASE}/api/geofences`, { headers: getHeaders() });
  return r.json();
}

export async function addGeofence(geofence) {
  const r = await fetch(`${API_BASE}/api/geofences`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(geofence),
  });
  if (!r.ok) {
    const err = await r.json();
    throw new Error(err.error || 'Failed to create geofence');
  }
  return r.json();
}

export async function getHistory(vehicleId, date) {
  const q = date ? `?date=${date}` : '';
  const r = await fetch(`${API_BASE}/api/history/${vehicleId}${q}`, { headers: getHeaders() });
  return r.json();
}

export async function getEta(from, to) {
  const params = new URLSearchParams({
    fromLat: from.lat,
    fromLng: from.lng,
    toLat: to.lat,
    toLng: to.lng,
  });
  const r = await fetch(`${API_BASE}/api/eta?${params}`, { headers: getHeaders() });
  if (!r.ok) throw new Error((await r.json()).error || 'ETA request failed');
  return r.json();
}
