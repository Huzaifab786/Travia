const axios = require("axios");

const getRouteBetweenPoints = async (start, end) => {
  const apiKey = process.env.ORS_API_KEY;

  if (!apiKey) {
    const err = new Error("ORS_API_KEY is missing in .env");
    err.statusCode = 500;
    throw err;
  }

  const url =
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

  const response = await axios.post(
    url,
    {
      coordinates: [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ],
    },
    {
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
    },
  );

  const feature = response.data?.features?.[0];
  if (!feature) {
    const err = new Error("Route not found");
    err.statusCode = 404;
    throw err;
  }

  const coords = feature.geometry.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));

  const summary = feature.properties?.summary || {};

  return {
    coordinates: coords,
    distanceMeters: summary.distance || 0,
    durationSeconds: summary.duration || 0,
  };
};

module.exports = { getRouteBetweenPoints };
