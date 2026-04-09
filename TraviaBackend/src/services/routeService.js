const axios = require("axios");

const osrm = axios.create({
  baseURL: "https://router.project-osrm.org",
  timeout: 10000,
});

const getRouteBetweenPoints = async (start, end) => {
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;

  const response = await osrm.get(`/route/v1/driving/${coordinates}`, {
    params: {
      overview: "full",
      geometries: "geojson",
      steps: false,
    },
  });

  const route = response.data?.routes?.[0];

  if (!route) {
    const err = new Error("Route not found");
    err.statusCode = 404;
    throw err;
  }

  const coords =
    route.geometry?.coordinates?.map(([lng, lat]) => ({
      lat,
      lng,
    })) || [];

  return {
    coordinates: coords,
    distanceMeters: route.distance || 0,
    durationSeconds: route.duration || 0,
  };
};

const getRouteAlternativesBetweenPoints = async (start, end) => {
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;

  const response = await osrm.get(`/route/v1/driving/${coordinates}`, {
    params: {
      overview: "full",
      geometries: "geojson",
      steps: false,
      alternatives: true,
      annotations: false,
    },
  });

  const routes = response.data?.routes || [];

  if (!routes.length) {
    const err = new Error("Route not found");
    err.statusCode = 404;
    throw err;
  }

  return routes.slice(0, 3).map((route, index) => ({
    id: `route-${index + 1}`,
    label:
      index === 0 ? "Preferred route" : index === 1 ? "Alternative route" : `Route ${index + 1}`,
    coordinates:
      route.geometry?.coordinates?.map(([lng, lat]) => ({
        lat,
        lng,
      })) || [],
    distanceMeters: route.distance || 0,
    durationSeconds: route.duration || 0,
  }));
};

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineLengthMeters(polyline) {
  if (!Array.isArray(polyline) || polyline.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1];
    if (!a || !b) continue;
    total += haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng);
  }
  return total;
}

function projectPointToMeters(lat, lng, refLat) {
  const latMeters = 110574;
  const lngMeters = 111320 * Math.cos((refLat * Math.PI) / 180);
  return {
    x: lng * lngMeters,
    y: lat * latMeters,
  };
}

function pointToSegmentDistanceMeters(lat, lng, a, b) {
  const refLat = (lat + a.lat + b.lat) / 3;
  const p = projectPointToMeters(lat, lng, refLat);
  const pa = projectPointToMeters(a.lat, a.lng, refLat);
  const pb = projectPointToMeters(b.lat, b.lng, refLat);

  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(p.x - pa.x, p.y - pa.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / (dx * dx + dy * dy)),
  );

  const closestX = pa.x + t * dx;
  const closestY = pa.y + t * dy;

  return Math.hypot(p.x - closestX, p.y - closestY);
}

function minDistanceToPolylineMeters(lat, lng, polyline) {
  if (!polyline || polyline.length < 2) {
    return Infinity;
  }

  let minDist = Infinity;

  for (let i = 0; i < polyline.length - 1; i += 1) {
    const dist = pointToSegmentDistanceMeters(lat, lng, polyline[i], polyline[i + 1]);
    if (dist < minDist) {
      minDist = dist;
    }
  }

  return minDist;
}

function projectPointToPolylineMeters(lat, lng, polyline) {
  if (!Array.isArray(polyline) || polyline.length < 2) {
    return {
      distanceFromRouteMeters: Infinity,
      distanceAlongRouteMeters: 0,
      routeLengthMeters: 0,
      routeRatio: null,
    };
  }

  const routeLengthMeters = polylineLengthMeters(polyline);
  let best = {
    distanceFromRouteMeters: Infinity,
    distanceAlongRouteMeters: 0,
    routeLengthMeters,
    routeRatio: null,
  };
  let distanceSoFar = 0;

  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1];
    if (!a || !b) continue;

    const refLat = (lat + a.lat + b.lat) / 3;
    const p = projectPointToMeters(lat, lng, refLat);
    const pa = projectPointToMeters(a.lat, a.lng, refLat);
    const pb = projectPointToMeters(b.lat, b.lng, refLat);

    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const segmentLengthMeters = haversineDistanceMeters(
      a.lat,
      a.lng,
      b.lat,
      b.lng,
    );

    let t = 0;
    if (!(dx === 0 && dy === 0)) {
      t = Math.max(
        0,
        Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / (dx * dx + dy * dy)),
      );
    }

    const closestX = pa.x + t * dx;
    const closestY = pa.y + t * dy;
    const distanceFromRouteMeters = Math.hypot(p.x - closestX, p.y - closestY);
    const distanceAlongRouteMeters = distanceSoFar + t * segmentLengthMeters;

    if (distanceFromRouteMeters < best.distanceFromRouteMeters) {
      best = {
        distanceFromRouteMeters,
        distanceAlongRouteMeters,
        routeLengthMeters,
        routeRatio: routeLengthMeters > 0 ? distanceAlongRouteMeters / routeLengthMeters : null,
      };
    }

    distanceSoFar += segmentLengthMeters;
  }

  return best;
}

module.exports = {
  getRouteBetweenPoints,
  getRouteAlternativesBetweenPoints,
  haversineDistanceMeters,
  polylineLengthMeters,
  minDistanceToPolylineMeters,
  projectPointToPolylineMeters,
};
