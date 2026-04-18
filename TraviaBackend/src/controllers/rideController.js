const prisma = require("../config/db");
const rideService = require("../services/rideService");
const { getIo } = require("../socket");
const { emitMultipleUserNotifications } = require("../services/notificationService");

const createRide = async (req, res) => {
  const {
    pickup,
    dropoff,
    departureTime,
    seatsTotal,
    notes,
    femaleOnly,
    checkpointCount,
    selectedRouteIndex,
    manualMeetupPoints,
  } = req.body;

  if (
    !pickup?.address ||
    pickup?.lat == null ||
    pickup?.lng == null ||
    !dropoff?.address ||
    dropoff?.lat == null ||
    dropoff?.lng == null
  ) {
    return res.status(400).json({
      message: "pickup and dropoff are required with address, lat, lng",
    });
  }

  if (!departureTime) {
    return res.status(400).json({ message: "departureTime is required" });
  }

  if (!seatsTotal || Number(seatsTotal) < 1) {
    return res.status(400).json({ message: "seatsTotal must be at least 1" });
  }

  const ride = await rideService.createRide(req.user.id, {
    pickup,
    dropoff,
    departureTime,
    seatsTotal: Number(seatsTotal),
    notes,
    femaleOnly: Boolean(femaleOnly),
    checkpointCount,
    selectedRouteIndex,
    manualMeetupPoints,
  });

  const shapedRide = {
    ...ride,
    pickup: { address: ride.pickupAddress, lat: ride.pickupLat, lng: ride.pickupLng },
    dropoff: { address: ride.dropoffAddress, lat: ride.dropoffLat, lng: ride.dropoffLng },
  };

  return res.status(201).json({ ride: shapedRide });
};

const listRides = async (req, res) => {
  const {
    search = "",
    pickupLat,
    pickupLng,
    routeRadiusKm,
    dropoffLat,
    dropoffLng,
    tripType,
  } = req.query;

  const parsedPickupLat =
    pickupLat != null && pickupLat !== "" ? Number(pickupLat) : null;
  const parsedPickupLng =
    pickupLng != null && pickupLng !== "" ? Number(pickupLng) : null;
  const parsedDropoffLat =
    dropoffLat != null && dropoffLat !== "" ? Number(dropoffLat) : null;
  const parsedDropoffLng =
    dropoffLng != null && dropoffLng !== "" ? Number(dropoffLng) : null;

  if (
    (parsedPickupLat != null && Number.isNaN(parsedPickupLat)) ||
    (parsedPickupLng != null && Number.isNaN(parsedPickupLng)) ||
    (parsedDropoffLat != null && Number.isNaN(parsedDropoffLat)) ||
    (parsedDropoffLng != null && Number.isNaN(parsedDropoffLng))
  ) {
    return res.status(400).json({
      message: "pickup/dropoff coordinates must be valid numbers",
    });
  }

  const rides = await rideService.listActiveRides({
    search,
    pickupLat: parsedPickupLat,
    pickupLng: parsedPickupLng,
    routeRadiusKm:
      routeRadiusKm != null && routeRadiusKm !== ""
        ? Number(routeRadiusKm)
        : null,
    dropoffLat: parsedDropoffLat,
    dropoffLng: parsedDropoffLng,
    tripType: tripType === "intra" || tripType === "inter" ? tripType : null,
    userGender: req.user?.gender ?? null,
  });

  return res.status(200).json({ rides });
};

const listMyRides = async (req, res) => {
  const rides = await rideService.listDriverRides(req.user.id);
  return res.status(200).json({ rides });
};

const cancelRide = async (req, res) => {
  const { id } = req.params;
  const ride = await rideService.cancelRide(req.user.id, id);
  return res.status(200).json({ ride });
};

// ─── Tracking Controllers ─────────────────────────────────────────────────────

/**
 * PATCH /rides/:id/location
 * Driver updates their live GPS position.
 */
const updateRideLocation = async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;

  if (lat == null || lng == null) {
    return res.status(400).json({ message: "lat and lng are required" });
  }

  const result = await rideService.updateDriverLocation(req.user.id, id, Number(lat), Number(lng));
  try {
    getIo().to(`ride_${id}`).emit("ride_location_updated", {
      rideId: id,
      lat: result.lat,
      lng: result.lng,
      lastUpdate: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Socket error", e);
  }
  return res.status(200).json(result);
};

/**
 * PATCH /rides/:id/location
 * Passenger polls for the driver's current position.
 */
const getRideLocation = async (req, res) => {
  const { id } = req.params;
  const location = await rideService.getDriverLocation(id);
  return res.status(200).json(location);
};

/**
 * PATCH /rides/:id/start
 * Driver marks the ride as in progress.
 */
const startRideController = async (req, res) => {
  const { id } = req.params;
  const ride = await rideService.startRide(req.user.id, id);
  try {
    getIo().to(`ride_${id}`).emit("ride_started", { rideId: id, status: ride.status });
    getIo().to(`ride_${id}`).emit("ride_status_updated", {
      rideId: id,
      status: ride.status,
    });
    const passengers = await prisma.booking.findMany({
      where: { rideId: id, status: { in: ["accepted", "picked_up"] } },
      select: { passengerId: true },
    });
    emitMultipleUserNotifications(
      [req.user.id, ...passengers.map((booking) => booking.passengerId)],
      (userId) => ({
        userId,
        title: "Ride started",
        body:
          userId === req.user.id
            ? "You started the ride."
            : "Your driver has started the ride.",
        type: "ride_started",
        data: { rideId: id, status: ride.status },
      }),
    );
  } catch (e) { console.error("Socket error", e); }
  return res.status(200).json({ ride });
};

/**
 * PATCH /rides/:id/complete
 * Driver marks the ride as completed.
 */
const completeRideController = async (req, res) => {
  const { id } = req.params;
  const ride = await rideService.completeRide(req.user.id, id);
  try {
    getIo().to(`ride_${id}`).emit("ride_completed", { rideId: id, status: ride.status });
    getIo().to(`ride_${id}`).emit("ride_status_updated", {
      rideId: id,
      status: ride.status,
    });
    const passengers = await prisma.booking.findMany({
      where: { rideId: id, status: "dropped_off" },
      select: { passengerId: true },
    });
    emitMultipleUserNotifications(
      [req.user.id, ...passengers.map((booking) => booking.passengerId)],
      (userId) => ({
        userId,
        title: "Ride completed",
        body:
          userId === req.user.id
            ? "You completed the ride."
            : "Your ride has been completed.",
        type: "ride_completed",
        data: { rideId: id, status: ride.status },
      }),
    );
  } catch (e) { console.error("Socket error", e); }
  return res.status(200).json({ ride });
};

/**
 * DELETE /rides/:id
 * Driver deletes a completed or cancelled ride.
 */
const deleteRideController = async (req, res) => {
  const { id } = req.params;
  const result = await rideService.deleteRide(req.user.id, id);
  return res.status(200).json(result);
};

const getRideById = async (req, res) => {
  const ride = await rideService.getRideById(req.params.id, req.user || {});
  return res.status(200).json({ ride });
};

module.exports = {
  createRide,
  listRides,
  getRideById,
  listMyRides,
  cancelRide,
  updateRideLocation,
  getRideLocation,
  startRideController,
  completeRideController,
  deleteRideController,
};
