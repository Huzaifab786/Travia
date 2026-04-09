const prisma = require("../config/db");
const {
  getRouteBetweenPoints,
  getRouteAlternativesBetweenPoints,
} = require("../services/routeService");

const getRideRoute = async (req, res) => {
  const { rideId } = req.params;

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
  });

  if (!ride) {
    return res.status(404).json({ message: "Ride not found" });
  }

  const route = await getRouteBetweenPoints(
    {
      lat: ride.pickupLat,
      lng: ride.pickupLng,
    },
    {
      lat: ride.dropoffLat,
      lng: ride.dropoffLng,
    }
  );

  return res.status(200).json(route);
};

const previewRoute = async (req, res) => {
  const startLat = Number(req.query.startLat);
  const startLng = Number(req.query.startLng);
  const endLat = Number(req.query.endLat);
  const endLng = Number(req.query.endLng);

  if (
    Number.isNaN(startLat) ||
    Number.isNaN(startLng) ||
    Number.isNaN(endLat) ||
    Number.isNaN(endLng)
  ) {
    return res.status(400).json({
      message: "startLat, startLng, endLat, endLng are required",
    });
  }

  const routes = await getRouteAlternativesBetweenPoints(
    { lat: startLat, lng: startLng },
    { lat: endLat, lng: endLng }
  );

  return res.status(200).json({
    route: routes[0],
    routes,
  });
};

module.exports = { getRideRoute, previewRoute };
