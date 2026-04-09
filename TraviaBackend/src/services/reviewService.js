const prisma = require("../config/db");

const createPassengerReview = async (passengerId, rideId, rating, comment) => {
  return prisma.$transaction(async (tx) => {
    const ride = await tx.ride.findUnique({
      where: { id: rideId },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ride) {
      const err = new Error("Ride not found");
      err.statusCode = 404;
      throw err;
    }

    if (ride.status !== "completed") {
      const err = new Error("You can only review a completed ride");
      err.statusCode = 400;
      throw err;
    }

    const booking = await tx.booking.findFirst({
      where: {
        rideId,
        passengerId,
        status: "accepted",
      },
    });

    if (!booking) {
      const err = new Error("Only passengers with accepted bookings can review this ride");
      err.statusCode = 403;
      throw err;
    }

    const existingReview = await tx.review.findFirst({
      where: {
        rideId,
        reviewerId: passengerId,
        revieweeId: ride.driverId,
      },
    });

    if (existingReview) {
      const err = new Error("You have already reviewed this ride");
      err.statusCode = 400;
      throw err;
    }

    const review = await tx.review.create({
      data: {
        rideId,
        reviewerId: passengerId,
        revieweeId: ride.driverId,
        rating,
        comment: comment?.trim() || null,
      },
      include: {
        reviewee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ride: {
          select: {
            id: true,
            pickupAddress: true,
            dropoffAddress: true,
            departureTime: true,
          },
        },
      },
    });

    return { review };
  });
};

const getMyReviewForRide = async (passengerId, rideId) => {
  const review = await prisma.review.findFirst({
    where: {
      rideId,
      reviewerId: passengerId,
    },
    include: {
      reviewee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return { review: review || null };
};

module.exports = {
  createPassengerReview,
  getMyReviewForRide,
};