const bookingService = require("../services/bookingService");

const createBooking = async (req, res) => {
  const { rideId, seatsRequested } = req.body;

  if (!rideId) {
    return res.status(400).json({ message: "rideId is required" });
  }

  const seats = Number(seatsRequested || 1);
  if (!seats || seats < 1) {
    return res
      .status(400)
      .json({ message: "seatsRequested must be at least 1" });
  }

  const booking = await bookingService.createBooking(req.user.id, rideId, seats);

  return res.status(201).json({ booking });
};

const listMyBookings = async (req, res) => {
  const bookings = await bookingService.listMyBookings(req.user.id);
  return res.status(200).json({ bookings });
};

const listDriverRequests = async (req, res) => {
  const bookings = await bookingService.listDriverRequests(req.user.id);
  return res.status(200).json({ bookings });
};

const updateBookingStatus = async (req, res) => {
  const { action } = req.body;
  const { id } = req.params;

  if (!action) {
    return res.status(400).json({ message: "action is required" });
  }

  const booking = await bookingService.updateBookingStatus(req.user.id, id, action);

  return res.status(200).json({ booking });
};

const getMyBookingForRide = async (req, res) => {
  const { rideId } = req.params;

  const booking = await bookingService.getPassengerBookingForRide(
    req.user.id,
    rideId
  );

  return res.status(200).json({ booking: booking || null });
};

const cancelMyBooking = async (req, res) => {
  const { id } = req.params;
  const booking = await bookingService.cancelMyBooking(req.user.id, id);
  return res.status(200).json({ booking });
};

const deleteBookingController = async (req, res) => {
  const { id } = req.params;
  const result = await bookingService.deleteBooking(req.user.id, id);
  return res.status(200).json(result);
};

module.exports = {
  createBooking,
  listMyBookings,
  listDriverRequests,
  updateBookingStatus,
  getMyBookingForRide,
  cancelMyBooking,
  deleteBookingController,
};