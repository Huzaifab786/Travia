const bookingService = require("../services/bookingService");
const { getIo } = require("../socket");
const { emitUserNotification } = require("../services/notificationService");

const createBooking = async (req, res) => {
  const {
    rideId,
    seatsRequested,
    meetupPoint,
    passengerPickup,
    passengerDropoff,
  } = req.body;

  if (!rideId) {
    return res.status(400).json({ message: "rideId is required" });
  }

  const seats = Number(seatsRequested || 1);
  if (!seats || seats < 1) {
    return res
      .status(400)
      .json({ message: "seatsRequested must be at least 1" });
  }

  const booking = await bookingService.createBooking(
    req.user.id,
    {
      rideId,
      seatsRequested: seats,
      meetupPoint,
      passengerPickup,
      passengerDropoff,
    },
  );

  try {
    emitUserNotification({
      userId: booking.ride.driverId,
      title: "New booking request",
      body: `${booking.passenger?.name || "A passenger"} requested ${booking.seatsRequested} seat(s).`,
      type: "booking_request",
      data: {
        rideId: booking.rideId,
        bookingId: booking.id,
      },
    });
  } catch (e) {
    console.error("Notification error", e);
  }

  return res.status(201).json({ booking });
};

const quoteBooking = async (req, res) => {
  const {
    rideId,
    seatsRequested,
    passengerPickup,
    passengerDropoff,
  } = req.body;

  if (!rideId) {
    return res.status(400).json({ message: "rideId is required" });
  }

  const quote = await bookingService.quoteBooking(req.user.id, {
    rideId,
    seatsRequested,
    passengerPickup,
    passengerDropoff,
  });

  return res.status(200).json({ quote });
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

  try {
    getIo().to(`ride_${booking.rideId}`).emit("booking_update", booking);
    getIo().to(`ride_${booking.rideId}`).emit("ride_status_updated", {
      rideId: booking.rideId,
      status: booking.ride.status,
      bookingStatus: booking.status,
    });

    if (booking.passenger?.id) {
      const notificationTitle =
        booking.status === "accepted"
          ? "Your booking was accepted"
          : booking.status === "rejected"
            ? "Your booking was declined"
            : booking.status === "picked_up"
              ? "Driver picked you up"
              : booking.status === "dropped_off"
                ? "Ride completed"
                : "Booking updated";

      const notificationBody =
        booking.status === "accepted"
          ? `${booking.ride?.driver?.name || "The driver"} accepted your booking.`
          : booking.status === "rejected"
            ? `${booking.ride?.driver?.name || "The driver"} declined your booking.`
            : booking.status === "picked_up"
              ? "Your driver marked the ride as picked up."
              : booking.status === "dropped_off"
                ? "Your trip has been completed."
                : "Your booking status changed.";

      emitUserNotification({
        userId: booking.passenger.id,
        title: notificationTitle,
        body: notificationBody,
        type: "booking_status",
        data: {
          rideId: booking.rideId,
          bookingId: booking.id,
          status: booking.status,
        },
      });
    }
  } catch (e) {
    console.error("Socket error", e);
  }

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
  quoteBooking,
};
