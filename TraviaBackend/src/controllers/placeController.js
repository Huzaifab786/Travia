const { searchPlaces, reverseGeocode } = require("../services/placeService");

const searchPlacesController = async (req, res) => {
  const { q, focusLat, focusLng } = req.query;
  const places = await searchPlaces(q, focusLat, focusLng);
  return res.status(200).json({ places });
};

const reverseGeocodeController = async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ message: "lat and lng are required" });
  }

  const place = await reverseGeocode(lat, lng);
  return res.status(200).json({ place: place || null });
};

module.exports = {
  searchPlacesController,
  reverseGeocodeController,
};