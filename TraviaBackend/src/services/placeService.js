const axios = require("axios");

const ORS_API_KEY = process.env.ORS_API_KEY;

const ors = axios.create({
  baseURL: "https://api.openrouteservice.org",
  headers: {
    Authorization: ORS_API_KEY,
  },
});

const searchPlaces = async (query, focusLat, focusLng) => {
  if (!query || query.trim().length < 3) {
    return [];
  }

  if (!ORS_API_KEY) {
    const err = new Error("ORS_API_KEY is missing in .env");
    err.statusCode = 500;
    throw err;
  }

  const params = {
    text: query,
    size: 10,
    layers: "address,venue,neighbourhood,locality,street",
  };

  if (focusLat != null && focusLng != null) {
    params["focus.point.lat"] = focusLat;
    params["focus.point.lon"] = focusLng;
  }

  const response = await ors.get("/geocode/autocomplete", { params });

  const features = response.data?.features || [];

  return features.map((item) => {
    const [lng, lat] = item.geometry.coordinates;
    const props = item.properties;
    
    // Build a more accurate and descriptive label
    const namePart = props.name || props.street || props.neighbourhood || "";
    const localityPart = props.locality || props.county || props.region || "";
    
    let label = namePart;
    if (localityPart && localityPart !== namePart) {
      if (label) label += `, ${localityPart}`;
      else label = localityPart;
    }
    
    if (!label) label = props.label || "Unknown place";

    return {
      id: String(props.id || props.gid || `${lat}-${lng}`),
      label,
      lat: Number(lat),
      lng: Number(lng),
    };
  });
};

const reverseGeocode = async (lat, lng) => {
  if (!ORS_API_KEY) {
    const err = new Error("ORS_API_KEY is missing in .env");
    err.statusCode = 500;
    throw err;
  }

  const response = await ors.get("/geocode/reverse", {
    params: {
      "point.lat": lat,
      "point.lon": lng,
      size: 1,
      layers: "address,venue,street,neighbourhood",
      "boundary.circle.radius": 0.5, // 500 meters radius
    },
  });

  const feature = response.data?.features?.[0];
  if (!feature) return null;

  const [resLng, resLat] = feature.geometry.coordinates;
  const props = feature.properties;

  // Enhance reverse geocoding label
  const streetName = props.street || props.name || "";
  const houseNumber = props.housenumber ? `${props.housenumber} ` : "";
  const neighborhood = props.neighbourhood ? `, ${props.neighbourhood}` : "";
  const locality = props.locality ? `, ${props.locality}` : "";
  
  let label = `${houseNumber}${streetName}${neighborhood}${locality}`.trim();
  if (label.startsWith(",")) label = label.substring(1).trim();
  if (!label) label = props.label || "Unknown address";

  return {
    id: String(
      props.id ||
      props.gid ||
        `${resLat}-${resLng}`
    ),
    label,
    lat: Number(resLat),
    lng: Number(resLng),
  };
};

module.exports = {
  searchPlaces,
  reverseGeocode,
};