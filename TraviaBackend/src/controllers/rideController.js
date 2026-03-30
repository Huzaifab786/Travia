const rideService = require("../services/rideService");

const createRide = async (req, res) => {
  const { pickup, dropoff, departureTime, seatsTotal, notes } = req.body;

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
  });

  const shapedRide = {
    ...ride,
    pickup: { address: ride.pickupAddress, lat: ride.pickupLat, lng: ride.pickupLng },
    dropoff: { address: ride.dropoffAddress, lat: ride.dropoffLat, lng: ride.dropoffLng },
  };

  return res.status(201).json({ ride: shapedRide });
};

const listRides = async (req, res) => {
  const rides = await rideService.listActiveRides();
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
  return res.status(200).json(result);
};

/**
 * GET /rides/:id/location
 * Passenger polls for the driver's current position.
 */
const getRideLocation = async (req, res) => {
  const { id } = req.params;
  const location = await rideService.getDriverLocation(id);
  return res.status(200).json(location);
};

/**
 * PATCH /rides/:id/complete
 * Driver marks the ride as completed.
 */
const completeRideController = async (req, res) => {
  const { id } = req.params;
  const ride = await rideService.completeRide(req.user.id, id);
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

module.exports = {
  createRide,
  listRides,
  listMyRides,
  cancelRide,
  updateRideLocation,
  getRideLocation,
  completeRideController,
  deleteRideController,
};