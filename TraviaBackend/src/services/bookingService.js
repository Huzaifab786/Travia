const prisma = require("../config/db");
const {
  getPricingSettings,
  buildPassengerTripQuote,
} = require("./pricingService");

function getBookingMeetupPoints(ride) {
  const storedPoints = Array.isArray(ride?.meetupPoints)
    ? ride.meetupPoints.filter(Boolean)
    : [];

  if (storedPoints.length > 0) {
    return storedPoints.map((point, index) => ({
      ...point,
      label:
        point.label ||
        (index === 0 ? "Driver pickup point" : `Pickup zone ${index + 1}`),
      address:
        point.address ||
        (index === 0
          ? ride?.pickupAddress || "Driver's starting pickup location"
          : `Suggested pickup point ${index + 1}`),
    }));
  }

  return ride?.pickupLat != null && ride?.pickupLng != null
    ? [
        {
          id: "ride-pickup",
          label: "Driver pickup point",
          lat: ride.pickupLat,
          lng: ride.pickupLng,
          address: ride.pickupAddress,
          order: 1,
          source: "pickup",
        },
      ]
    : [];
}

function pickMeetupPoint(ride, meetupPoint) {
  const availablePoints = getBookingMeetupPoints(ride);

  if (meetupPoint && typeof meetupPoint === "object") {
    const match = availablePoints.find((point) => point.id === meetupPoint.id);
    if (match) {
      return match;
    }
  }

  if (availablePoints.length > 0) {
    return availablePoints[0];
  }

  return {
    id: "ride-pickup",
    label: "Ride pickup point",
    lat: ride.pickupLat,
    lng: ride.pickupLng,
    address: ride.pickupAddress,
  };
}

function normalizeTripPlace(place) {
  if (!place || typeof place !== "object") {
    return null;
  }

  const lat = Number(place.lat);
  const lng = Number(place.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    id: place.id || `${lat}-${lng}`,
    label: place.label || place.address || "Trip point",
    address: place.address || place.label || null,
    lat,
    lng,
  };
}

const syncRideStatusFromAcceptedBookings = async (tx, rideId) => {
  const ride = await tx.ride.findUnique({
    where: { id: rideId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!ride) {
    return;
  }

  const acceptedAgg = await tx.booking.aggregate({
    where: {
      rideId,
      status: "accepted",
    },
    _sum: {
      seatsRequested: true,
    },
  });

  const acceptedSeats = acceptedAgg._sum.seatsRequested || 0;

  if (acceptedSeats > 0 && ride.status === "active") {
    await tx.ride.update({
      where: { id: rideId },
      data: { status: "ready" },
    });
  }

  if (acceptedSeats === 0 && ride.status === "ready") {
    await tx.ride.update({
      where: { id: rideId },
      data: { status: "active" },
    });
  }
};

const createBooking = async (passengerId, payload) => {
  const rideId = payload?.rideId;
  const seatsRequested = Number(payload?.seatsRequested || 1);
  const meetupPoint = payload?.meetupPoint;
  const passengerPickup = normalizeTripPlace(payload?.passengerPickup);
  const passengerDropoff = normalizeTripPlace(payload?.passengerDropoff);

  if (!rideId) {
    const err = new Error("rideId is required");
    err.statusCode = 400;
    throw err;
  }

  if (!passengerPickup || !passengerDropoff) {
    const err = new Error(
      "Passenger pickup and dropoff are required for shared-route booking",
    );
    err.statusCode = 400;
    throw err;
  }

  // Use a transaction to avoid race conditions
  return await prisma.$transaction(async (tx) => {
    const [ride, passenger, pricingSettings] = await Promise.all([
      tx.ride.findUnique({
        where: { id: rideId },
        include: {
          driver: {
            select: {
              vehicle: {
                select: {
                  avgKmPerLitre: true,
                },
              },
            },
          },
        },
      }),
      tx.user.findUnique({
        where: { id: passengerId },
        select: { gender: true, role: true },
      }),
      getPricingSettings(),
    ]);

    if (!ride) {
      const err = new Error("Ride not found");
      err.statusCode = 404;
      throw err;
    }

    if (ride.femaleOnly && passenger?.gender !== "female") {
      const err = new Error(
        "This ride is available for female passengers only.",
      );
      err.statusCode = 403;
      throw err;
    }

    if (!["active", "ready"].includes(ride.status)) {
      const err = new Error("Ride is not available for booking");
      err.statusCode = 400;
      throw err;
    }

    // Duplicate prevention (matches your previous logic)
    const [existing, acceptedAgg] = await Promise.all([
      tx.booking.findFirst({
        where: {
          rideId,
          passengerId,
          status: "pending",
        },
      }),
      tx.booking.aggregate({
        where: { rideId, status: "accepted" },
        _sum: { seatsRequested: true },
      }),
    ]);

    if (existing) {
      const err = new Error("You already have a pending booking for this ride");
      err.statusCode = 400;
      throw err;
    }

    const acceptedSeats = acceptedAgg._sum.seatsRequested || 0;
    const seatsLeft = ride.seatsTotal - acceptedSeats;

    if (seatsLeft < seatsRequested) {
      const err = new Error("Not enough seats available");
      err.statusCode = 400;
      throw err;
    }

    const pricingQuote = buildPassengerTripQuote({
      ridePolyline: (() => {
        try {
          return ride.encodedPolyline ? JSON.parse(ride.encodedPolyline) : [];
        } catch {
          return [];
        }
      })(),
      rideDistanceMeters: ride.distanceMeters,
      passengerPickup,
      passengerDropoff,
      seatsTotal: ride.seatsTotal,
      avgKmPerLitre: ride.driver?.vehicle?.avgKmPerLitre,
      fuelPricePerLitre: pricingSettings.fuelPricePerLitre,
      routeRadiusKm: pricingSettings.routeRadiusKm,
    });

    const booking = await tx.booking.create({
      data: {
        rideId,
        passengerId,
        seatsRequested,
        meetupPoint: pickMeetupPoint(ride, meetupPoint),
        passengerPickup,
        passengerDropoff,
        pricingQuote: {
          ...pricingQuote,
          totalPrice: Math.round(pricingQuote.finalPrice * seatsRequested),
          perSeatPrice: pricingQuote.finalPrice,
        },
        status: "pending",
      },
      include: {
        ride: true,
        passenger: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    return {
      ...booking,
      passengerPickup,
      passengerDropoff,
      pricingQuote: {
        ...pricingQuote,
        totalPrice: Math.round(pricingQuote.finalPrice * seatsRequested),
        perSeatPrice: pricingQuote.finalPrice,
      },
    };
  }, {
    maxWait: 10000,
    timeout: 20000,
  });
};

const quoteBooking = async (passengerId, payload) => {
  const rideId = payload?.rideId;
  const seatsRequested = Math.max(1, Number(payload?.seatsRequested || 1));
  const passengerPickup = normalizeTripPlace(payload?.passengerPickup);
  const passengerDropoff = normalizeTripPlace(payload?.passengerDropoff);

  if (!rideId) {
    const err = new Error("rideId is required");
    err.statusCode = 400;
    throw err;
  }

  if (!passengerPickup || !passengerDropoff) {
    const err = new Error(
      "Passenger pickup and dropoff are required for pricing",
    );
    err.statusCode = 400;
    throw err;
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      driver: {
        select: {
          vehicle: {
            select: {
              avgKmPerLitre: true,
            },
          },
        },
      },
    },
  });

  if (!ride) {
    const err = new Error("Ride not found");
    err.statusCode = 404;
    throw err;
  }

  const pricingSettings = await getPricingSettings();
  const pricingQuote = buildPassengerTripQuote({
    ridePolyline: (() => {
      try {
        return ride.encodedPolyline ? JSON.parse(ride.encodedPolyline) : [];
      } catch {
        return [];
      }
    })(),
    rideDistanceMeters: ride.distanceMeters,
    passengerPickup,
    passengerDropoff,
    seatsTotal: ride.seatsTotal,
    avgKmPerLitre: ride.driver?.vehicle?.avgKmPerLitre,
    fuelPricePerLitre: pricingSettings.fuelPricePerLitre,
    routeRadiusKm: pricingSettings.routeRadiusKm,
  });

  return {
    rideId,
    seatsRequested,
    passengerPickup,
    passengerDropoff,
    pricingQuote: {
      ...pricingQuote,
      totalPrice: Math.round(pricingQuote.finalPrice * seatsRequested),
      perSeatPrice: pricingQuote.finalPrice,
    },
  };
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

  const reviews = await prisma.review.findMany({
    where: { reviewerId: passengerId },
    select: {
      rideId: true,
      revieweeId: true,
    },
  });

  const reviewedSet = new Set(
    reviews.map((r) => `${r.rideId}:${r.revieweeId}`),
  );

  return bookings.map((b) => {
    const hasReviewed = reviewedSet.has(`${b.ride.id}:${b.ride.driverId}`);

    return {
      ...b,
      hasReviewed,
      passengerPickup: b.passengerPickup || null,
      passengerDropoff: b.passengerDropoff || null,
      pricingQuote: b.pricingQuote || null,
      ride: {
        ...b.ride,
        meetupPoints: getBookingMeetupPoints(b.ride),
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
        encodedPolyline: b.ride.encodedPolyline || null,
      },
    };
  });
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
    passengerPickup: b.passengerPickup || null,
    passengerDropoff: b.passengerDropoff || null,
    pricingQuote: b.pricingQuote || null,
    ride: {
      ...b.ride,
      meetupPoints: getBookingMeetupPoints(b.ride),
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
        passenger: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    await syncRideStatusFromAcceptedBookings(tx, booking.rideId);

    // reshape ride pickup/dropoff
    return {
      ...updated,
      passengerPickup: updated.passengerPickup || null,
      passengerDropoff: updated.passengerDropoff || null,
      pricingQuote: updated.pricingQuote || null,
      ride: {
        ...updated.ride,
        meetupPoints: getBookingMeetupPoints(updated.ride),
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

  if (!booking) {
    return booking;
  }

  return {
    ...booking,
    meetupPoint: booking.meetupPoint || null,
    passengerPickup: booking.passengerPickup || null,
    passengerDropoff: booking.passengerDropoff || null,
    pricingQuote: booking.pricingQuote || null,
  };
};

const cancelMyBooking = async (passengerId, bookingId) => {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        ride: true,
      },
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

    const canCancelPending = booking.status === "pending";
    const canCancelAccepted =
      booking.status === "accepted" &&
      ["active", "ready"].includes(booking.ride.status);

    if (!canCancelPending && !canCancelAccepted) {
      const err = new Error("This booking can no longer be cancelled");
      err.statusCode = 400;
      throw err;
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
    });

    await syncRideStatusFromAcceptedBookings(tx, booking.rideId);

    return updated;
  });
};

/**
 * Delete (hide/remove) a completed or cancelled booking (passenger only).
 */
const deleteBooking = async (passengerId, bookingId) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking)
    throw Object.assign(new Error("Booking not found"), { statusCode: 404 });
  if (booking.passengerId !== passengerId)
    throw Object.assign(new Error("Not authorized"), { statusCode: 403 });

  // Only allow deleting history (not active bookings)
  if (booking.status === "pending" || booking.status === "accepted") {
    throw Object.assign(
      new Error("Cannot delete an active booking. Cancel it first."),
      { statusCode: 400 },
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
  quoteBooking,
};
