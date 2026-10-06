// Routing service using OpenStreetMap / OSRM public routing API
// Snaps coordinates to real road networks, finds shortest driving route,
// and calculates exact driving distances and durations.

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fallback if OSRM service is unreachable
function calculateFallbackRoadData(waypoints) {
  let distanceMeters = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    distanceMeters += haversineMeters(p1[0], p1[1], p2[0], p2[1]);
  }
  // Assume avg speed of 40 km/h (11.1 m/s)
  const durationSeconds = Math.round(distanceMeters / 11.1);
  return {
    roadCoordinates: waypoints,
    distanceMeters: Math.round(distanceMeters),
    durationSeconds,
  };
}

/**
 * Fetch shortest road route geometry, road distance and driving duration from OSRM.
 * @param {Array<[number, number]>} waypoints - Array of [lat, lng] coordinates
 * @returns {Promise<{roadCoordinates: Array<[number, number]>, distanceMeters: number, durationSeconds: number}>}
 */
export async function getRoadRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) {
    return calculateFallbackRoadData(waypoints || []);
  }

  try {
    // OSRM expects: lng,lat;lng,lat;...
    const coordsStr = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`OSRM returned status ${res.status}, falling back to direct waypoints`);
      return calculateFallbackRoadData(waypoints);
    }

    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      // Convert GeoJSON [lng, lat] to Leaflet standard [lat, lng]
      const roadCoordinates = primaryRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      return {
        roadCoordinates,
        distanceMeters: Math.round(primaryRoute.distance),
        durationSeconds: Math.round(primaryRoute.duration),
      };
    } else {
      console.warn('OSRM did not return Ok route code, falling back');
      return calculateFallbackRoadData(waypoints);
    }
  } catch (err) {
    console.warn('OSRM routing request failed:', err.message, '- falling back to direct waypoints');
    return calculateFallbackRoadData(waypoints);
  }
}

export { haversineMeters };
