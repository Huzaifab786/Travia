const axios = require("axios");

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

const geoapify = axios.create({
  baseURL: "https://api.geoapify.com/v1",
});

const buildLabel = (props = {}) => {
  const parts = [
    props.name,
    props.housenumber ? `${props.housenumber} ${props.street || ""}`.trim() : props.street,
    props.suburb,
    props.city || props.town || props.village,
    props.state,
    props.country,
  ].filter(Boolean);

  return parts.join(", ") || props.formatted || "Unknown place";
};

const searchPlaces = async (query, focusLat, focusLng) => {
  if (!query || query.trim().length < 3) {
    return [];
  }

  if (!GEOAPIFY_API_KEY) {
    const err = new Error("GEOAPIFY_API_KEY is missing in .env");
    err.statusCode = 500;
    throw err;
  }

  const params = {
    text: query.trim(),
    apiKey: GEOAPIFY_API_KEY,
    limit: 12,
    format: "json",
  };

  if (focusLat != null && focusLng != null) {
    params.bias = `proximity:${focusLng},${focusLat}`;
  }

  const response = await geoapify.get("/geocode/autocomplete", { params });

  const results = response.data?.results || [];

  return results.map((item) => ({
    id: String(item.place_id || `${item.lat}-${item.lon}`),
    label: item.formatted || buildLabel(item),
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
};

const reverseGeocode = async (lat, lng) => {
  if (!GEOAPIFY_API_KEY) {
    const err = new Error("GEOAPIFY_API_KEY is missing in .env");
    err.statusCode = 500;
    throw err;
  }

  const response = await geoapify.get("/geocode/reverse", {
    params: {
      lat,
      lon: lng,
      apiKey: GEOAPIFY_API_KEY,
      format: "json",
    },
  });

  const item = response.data?.results?.[0];
  if (!item) return null;

  return {
    id: String(item.place_id || `${item.lat}-${item.lon}`),
    label: item.formatted || buildLabel(item),
    lat: Number(item.lat),
    lng: Number(item.lon),
  };
};

module.exports = {
  searchPlaces,
  reverseGeocode,
};