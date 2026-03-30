const prisma = require("../config/db");

const createBooking = async (passengerId, rideId, seatsRequested) => {
  // Use a transaction to avoid race conditions
  return await prisma.$transaction(async (tx) => {
    const ride = await tx.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      const err = new Error("Ride not found");
      err.statusCode = 404;
      throw err;
    }

    if (ride.status !== "active") {
      const err = new Error("Ride is not active");
      err.statusCode = 400;
      throw err;
    }

    // Duplicate prevention (matches your previous logic)
    const existing = await tx.booking.findFirst({
      where: {
        rideId,
        passengerId,
        status: "pending",
      },
    });

    if (existing) {
      const err = new Error("You already have a pending booking for this ride");
      err.statusCode = 400;
      throw err;
    }

    // Seats available = seatsTotal - acceptedSeats
    const acceptedAgg = await tx.booking.aggregate({
      where: { rideId, status: "accepted" },
      _sum: { seatsRequested: true },
    });

    const acceptedSeats = acceptedAgg._sum.seatsRequested || 0;
    const seatsLeft = ride.seatsTotal - acceptedSeats;

    if (seatsLeft < seatsRequested) {
      const err = new Error("Not enough seats available");
      err.statusCode = 400;
      throw err;
    }

    const booking = await tx.booking.create({
      data: {
        rideId,
        passengerId,
        seatsRequested,
        status: "pending",
      },
      include: {
        ride: true,
        passenger: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return booking;
  });
};

const listMyBookings = async (passengerId) => {
  const bookings = await prisma.booking.findMany({
    where: { passengerId },
    orderBy: { createdAt: "desc" },
    include: {
      ride: {
        include: {
          driver: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  // reshape ride pickup/dropoff to match frontend
  return bookings.map((b) => ({
    ...b,
    ride: {
      ...b.ride,
      pickup: {
        address: b.ride.pickupAddress,
        lat: b.ride.pickupLat,
        lng: b.ride.pickupLng,
      },
      dropoff: {
        address: b.ride.dropoffAddress,
        lat: b.ride.dropoffLat,
        lng: b.ride.dropoffLng,
      },
    },
  }));
};

const listDriverRequests = async (driverId) => {
  const bookings = await prisma.booking.findMany({
    where: {
      status: "pending",
      ride: { driverId },
    },
    orderBy: { createdAt: "desc" },
    include: {
      ride: {
        include: {
          driver: { select: { id: true, name: true, email: true, role: true } },
        },
      },
      passenger: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // reshape ride pickup/dropoff to match frontend
  return bookings.map((b) => ({
    ...b,
    ride: {
      ...b.ride,
      pickup: {
        address: b.ride.pickupAddress,
        lat: b.ride.pickupLat,
        lng: b.ride.pickupLng,
      },
      dropoff: {
        address: b.ride.dropoffAddress,
        lat: b.ride.dropoffLat,
        lng: b.ride.dropoffLng,
      },
    },
  }));
};

const updateBookingStatus = async (driverId, bookingId, action) => {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { ride: true },
    });

    if (!booking) {
      const err = new Error("Booking not found");
      err.statusCode = 404;
      throw err;
    }

    if (!booking.ride || booking.ride.driverId !== driverId) {
      const err = new Error("Not authorized for this booking");
      err.statusCode = 403;
      throw err;
    }

    if (booking.status !== "pending") {
      const err = new Error("Booking already processed");
      err.statusCode = 400;
      throw err;
    }

    if (action !== "accept" && action !== "reject") {
      const err = new Error("Invalid action");
      err.statusCode = 400;
      throw err;
    }

    // If accepting, re-check seats to prevent overbooking
    if (action === "accept") {
      const acceptedAgg = await tx.booking.aggregate({
        where: { rideId: booking.rideId, status: "accepted" },
        _sum: { seatsRequested: true },
      });

      const acceptedSeats = acceptedAgg._sum.seatsRequested || 0;
      const seatsLeft = booking.ride.seatsTotal - acceptedSeats;

      if (seatsLeft < booking.seatsRequested) {
        const err = new Error("Not enough seats available");
        err.statusCode = 400;
        throw err;
      }
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: action === "accept" ? "accepted" : "rejected" },
      include: {
        ride: true,
        passenger: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // reshape ride pickup/dropoff
    return {
      ...updated,
      ride: {
        ...updated.ride,
        pickup: {
          address: updated.ride.pickupAddress,
          lat: updated.ride.pickupLat,
          lng: updated.ride.pickupLng,
        },
        dropoff: {
          address: updated.ride.dropoffAddress,
          lat: updated.ride.dropoffLat,
          lng: updated.ride.dropoffLng,
        },
      },
    };
  });
};

const getPassengerBookingForRide = async (passengerId, rideId) => {
  const booking = await prisma.booking.findFirst({
    where: {
      passengerId,
      rideId,
      status: { in: ["pending", "accepted"] },
    },
  });

  return booking;
};

const cancelMyBooking = async (passengerId, bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    const err = new Error("Booking not found");
    err.statusCode = 404;
    throw err;
  }

  if (booking.passengerId !== passengerId) {
    const err = new Error("Not authorized to cancel this booking");
    err.statusCode = 403;
    throw err;
  }

  if (booking.status !== "pending") {
    const err = new Error("Only pending bookings can be cancelled");
    err.statusCode = 400;
    throw err;
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "cancelled" },
  });

  return updated;
};

/**
 * Delete (hide/remove) a completed or cancelled booking (passenger only).
 */
const deleteBooking = async (passengerId, bookingId) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw Object.assign(new Error("Booking not found"), { statusCode: 404 });
  if (booking.passengerId !== passengerId) throw Object.assign(new Error("Not authorized"), { statusCode: 403 });

  // Only allow deleting history (not active bookings)
  if (booking.status === "pending" || booking.status === "accepted") {
    throw Object.assign(
      new Error("Cannot delete an active booking. Cancel it first."),
      { statusCode: 400 }
    );
  }

  await prisma.booking.delete({ where: { id: bookingId } });
  return { deleted: true, bookingId };
};

module.exports = {
  createBooking,
  listMyBookings,
  listDriverRequests,
  updateBookingStatus,
  getPassengerBookingForRide,
  cancelMyBooking,
  deleteBooking,
};