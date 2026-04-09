const prisma = require("../config/db");
const {
  getRouteBetweenPoints,
  getRouteAlternativesBetweenPoints,
  minDistanceToPolylineMeters,
} = require("./routeService");
const {
  getPricingSettings,
  calculateSharedFare,
} = require("./pricingService");

function buildFareBreakdown({
  distanceMeters,
  seatsTotal,
  avgKmPerLitre,
  fuelPricePerLitre,
}) {
  if (
    distanceMeters == null ||
    avgKmPerLitre == null ||
    fuelPricePerLitre == null
  ) {
    return null;
  }

  return calculateSharedFare({
    distanceMeters,
    seatsTotal,
    avgKmPerLitre,
    fuelPricePerLitre,
  });
}

function normalizeMeetupPoints(ride) {
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
          address: ride?.pickupAddress || "Driver's starting pickup location",
          lat: ride?.pickupLat,
          lng: ride?.pickupLng,
          order: 1,
          source: "pickup",
        },
      ]
    : [];
}

const createRide = async (driverId, payload) => {
  const {
    pickup,
    dropoff,
    departureTime,
    seatsTotal,
    notes,
    femaleOnly = false,
    checkpointCount,
    selectedRouteIndex = 0,
    manualMeetupPoints,
  } = payload;

  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { gender: true, role: true },
  });

  if (!driver) {
    const err = new Error("Driver not found");
    err.statusCode = 404;
    throw err;
  }

  if (femaleOnly && driver.gender !== "female") {
    const err = new Error("Only female drivers can create female-only rides.");
    err.statusCode = 403;
    throw err;
  }

  // 1. Fetch driver's vehicle info for cost-sharing calculation
  const vehicle = await prisma.vehicle.findUnique({
    where: { userId: driverId },
  });

  if (!vehicle) {
    const err = new Error(
      "Please set up your vehicle details first (Car Model, Fuel Average, etc.) to calculate shared costs.",
    );
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch route geometry and distance from the backend selected route
  const routeAlternatives = await getRouteAlternativesBetweenPoints(
    { lat: Number(pickup.lat), lng: Number(pickup.lng) },
    { lat: Number(dropoff.lat), lng: Number(dropoff.lng) },
  );
  const route =
    routeAlternatives[Math.max(0, Number(selectedRouteIndex) || 0)] ||
    routeAlternatives[0] ||
    (await getRouteBetweenPoints(
      { lat: Number(pickup.lat), lng: Number(pickup.lng) },
      { lat: Number(dropoff.lat), lng: Number(dropoff.lng) },
    ));

  const routeCoords = Array.isArray(route.coordinates) ? route.coordinates : [];
  const distanceMeters = route.distanceMeters || 0;
  const durationSeconds = route.durationSeconds || 0;

  // Store coordinates for polyline visualization
  const encodedPolyline = JSON.stringify(routeCoords);
  const manualPoints = Array.isArray(manualMeetupPoints)
    ? manualMeetupPoints
        .filter(
          (point) =>
            point &&
            typeof point.lat === "number" &&
            typeof point.lng === "number",
        )
        .slice(0, 2)
        .map((point, index) => ({
          id: point.id || `manual-checkpoint-${index + 1}`,
          label: point.label || `Landmark ${index + 1}`,
          address: point.address || point.label || `Landmark ${index + 1}`,
          lat: Number(point.lat),
          lng: Number(point.lng),
          order: index + 1,
          source: "manual",
        }))
    : [];
  const driverPickupPoint = {
    id: "ride-pickup",
    label: "Driver pickup point",
    address: pickup.address,
    placeName: pickup.address,
    lat: Number(pickup.lat),
    lng: Number(pickup.lng),
    order: 1,
    source: "pickup",
  };
  const finalMeetupPoints = [driverPickupPoint, ...manualPoints].slice(
    0,
    Math.max(1, 1 + manualPoints.length),
  );

  // 3. Pure Cost-Sharing Logic (FYP Requirement)
  const pricingSettings = await getPricingSettings();
  const pricing = calculateSharedFare({
    distanceMeters,
    seatsTotal,
    avgKmPerLitre: vehicle.avgKmPerLitre,
    fuelPricePerLitre: pricingSettings.fuelPricePerLitre,
  });
  const seatsCount = Number(seatsTotal);
  const finalPrice = pricing.finalPrice;

  const ride = await prisma.ride.create({
    data: {
      driverId,
      pickupAddress: pickup.address,
      pickupLat: Number(pickup.lat),
      pickupLng: Number(pickup.lng),
      dropoffAddress: dropoff.address,
      dropoffLat: Number(dropoff.lat),
      dropoffLng: Number(dropoff.lng),
      departureTime: new Date(departureTime),
      price: finalPrice, // cost per seat
      seatsTotal: seatsCount,
      notes: notes || null,
      femaleOnly: Boolean(femaleOnly),
      status: "active",
      encodedPolyline,
      meetupPoints: finalMeetupPoints,
      distanceMeters,
      durationSeconds,
    },
  });

  return {
    ...ride,
    fareBreakdown: pricing,
    meetupPoints: finalMeetupPoints,
  };
};

const listActiveRides = async ({
  search = "",
  pickupLat = null,
  pickupLng = null,
  routeRadiusKm = 5,
  dropoffLat = null,
  dropoffLng = null,
  tripType = null,
  userGender = null,
} = {}) => {
  const pricingSettings = await getPricingSettings();
  const effectiveRouteRadiusKm =
    routeRadiusKm != null && Number.isFinite(Number(routeRadiusKm))
      ? Number(routeRadiusKm)
      : pricingSettings.routeRadiusKm || 5;

const rides = await prisma.ride.findMany({
  where: {
    status: { in: ["active", "ready"] },
    departureTime: {
      gte: new Date(),
    },
    ...(userGender === "female" ? {} : { femaleOnly: false }),
  },
  orderBy: {
    departureTime: "asc",
  },
  include: {
    driver: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        reviewsGot: {
          select: { rating: true },
        },
      },
    },
    bookings: {
      where: { status: "accepted" },
      select: { seatsRequested: true },
    },
  },
});

  const normalizedSearch = String(search || "")
    .trim()
    .toLowerCase();
  const now = Date.now();

  const scoredRides = rides.map((r) => {
    const ratings = r.driver.reviewsGot || [];
    const totalReviews = ratings.length;
    const avgRating =
      totalReviews > 0
        ? ratings.reduce((sum, item) => sum + item.rating, 0) / totalReviews
        : null;

    const acceptedSeats = (r.bookings || []).reduce(
      (sum, booking) => sum + booking.seatsRequested,
      0,
    );

    const seatsAvailable = Math.max(r.seatsTotal - acceptedSeats, 0);

    const pickupAddress = (r.pickupAddress || "").toLowerCase();
    const dropoffAddress = (r.dropoffAddress || "").toLowerCase();

    let searchScore = 0;

    if (normalizedSearch) {
      if (pickupAddress.includes(normalizedSearch)) searchScore += 25;
      if (dropoffAddress.includes(normalizedSearch)) searchScore += 25;

      const searchWords = normalizedSearch.split(/\s+/).filter(Boolean);
      for (const word of searchWords) {
        if (pickupAddress.includes(word)) searchScore += 8;
        if (dropoffAddress.includes(word)) searchScore += 8;
      }
    } else {
      searchScore += 10;
    }

    let pickupProximityScore = 0;
    let pickupDistanceKm = null;

    if (pickupLat != null && pickupLng != null) {
      pickupDistanceKm =
        haversineDistance(
          Number(pickupLat),
          Number(pickupLng),
          r.pickupLat,
          r.pickupLng,
        ) / 1000;

      if (pickupDistanceKm <= 1) pickupProximityScore = 35;
      else if (pickupDistanceKm <= 3) pickupProximityScore = 28;
      else if (pickupDistanceKm <= 5) pickupProximityScore = 20;
      else if (pickupDistanceKm <= 10) pickupProximityScore = 10;
      else pickupProximityScore = 0;
    }

    let dropoffProximityScore = 0;
    let dropoffDistanceKm = null;

    if (dropoffLat != null && dropoffLng != null) {
      dropoffDistanceKm =
        haversineDistance(
          Number(dropoffLat),
          Number(dropoffLng),
          r.dropoffLat,
          r.dropoffLng,
        ) / 1000;

      if (dropoffDistanceKm <= 1) dropoffProximityScore = 30;
      else if (dropoffDistanceKm <= 3) dropoffProximityScore = 22;
      else if (dropoffDistanceKm <= 5) dropoffProximityScore = 15;
      else if (dropoffDistanceKm <= 10) dropoffProximityScore = 8;
      else dropoffProximityScore = 0;
    }

    const seatScore =
      seatsAvailable <= 0 ? -100 : Math.min(seatsAvailable * 4, 16);

    const ratingScore = avgRating != null ? Math.min(avgRating * 5, 25) : 8;

    const reviewConfidenceScore =
      totalReviews >= 10
        ? 10
        : totalReviews >= 5
          ? 6
          : totalReviews >= 1
            ? 3
            : 0;

    const priceScore = Math.max(0, 12 - Number(r.price || 0) / 60);
    const rideDistanceKm = Number(r.distanceMeters || 0) / 1000;

    let routeProximityKm = null;
    if (pickupLat != null && pickupLng != null && r.encodedPolyline) {
      try {
        const polyline = JSON.parse(r.encodedPolyline);
        routeProximityKm =
          minDistanceToPolylineMeters(
            Number(pickupLat),
            Number(pickupLng),
            polyline,
          ) / 1000;
      } catch (_) {
        routeProximityKm = null;
      }
    }

    if (
      routeProximityKm != null &&
      routeProximityKm > Number(effectiveRouteRadiusKm)
    ) {
      return null;
    }

    const departureMs = new Date(r.departureTime).getTime();
    const hoursUntilDeparture = Math.max(
      0,
      (departureMs - now) / (1000 * 60 * 60),
    );

    let departureScore = 0;
    if (hoursUntilDeparture <= 1) departureScore = 20;
    else if (hoursUntilDeparture <= 3) departureScore = 16;
    else if (hoursUntilDeparture <= 6) departureScore = 12;
    else if (hoursUntilDeparture <= 12) departureScore = 8;
    else if (hoursUntilDeparture <= 24) departureScore = 5;
    else departureScore = 2;

    const smartScore = Math.round(
      searchScore +
        pickupProximityScore +
        dropoffProximityScore +
        seatScore +
        ratingScore +
        reviewConfidenceScore +
        priceScore +
        departureScore,
    );

    let matchLabel = "Fair Match";
    if (smartScore >= 100) matchLabel = "Best Match";
    else if (smartScore >= 70) matchLabel = "Good Match";

    const isIntraCityRide = rideDistanceKm > 0 ? rideDistanceKm <= 60 : null;
    if (tripType === "intra" && isIntraCityRide === false) {
      return null;
    }

    if (tripType === "inter" && isIntraCityRide === true) {
      return null;
    }

    return {
      ...r,
      smartScore,
      matchLabel,
      seatsAvailable,
      rideDistanceKm,
      tripType: isIntraCityRide == null ? null : isIntraCityRide ? "intra" : "inter",
      pickupDistanceKm,
      dropoffDistanceKm,
      routeProximityKm,
      sharedRouteRide: true,
      driver: {
        ...r.driver,
        avgRating,
        totalReviews,
      },
      pickup: {
        address: r.pickupAddress,
        lat: r.pickupLat,
        lng: r.pickupLng,
      },
      dropoff: {
        address: r.dropoffAddress,
        lat: r.dropoffLat,
        lng: r.dropoffLng,
      },
      meetupPoints: normalizeMeetupPoints(r),
      femaleOnly: r.femaleOnly,
    };
  });

  const filteredRides = scoredRides.filter(Boolean);

  filteredRides.sort((a, b) => {
    if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore;
    return (
      new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );
  });

  return filteredRides;
};

const listDriverRides = async (driverId) => {
  const rides = await prisma.ride.findMany({
    where: { driverId },
    orderBy: { createdAt: "desc" },
  });

  const rideIds = rides.map((r) => r.id);

  const acceptedBookings = await prisma.booking.findMany({
    where: {
      rideId: { in: rideIds },
      status: "accepted",
    },
    select: {
      id: true,
      rideId: true,
      passengerId: true,
      seatsRequested: true,
      meetupPoint: true,
      passenger: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate booking stats using Prisma groupBy
  const grouped = await prisma.booking.groupBy({
    by: ["rideId", "status"],
    where: { rideId: { in: rideIds } },
    _count: { _all: true },
    _sum: { seatsRequested: true },
  });

  const statsByRide = {};
  for (const g of grouped) {
    const rideId = g.rideId;
    const status = g.status;
    const count = g._count._all;
    const seats = g._sum.seatsRequested || 0;

    if (!statsByRide[rideId]) {
      statsByRide[rideId] = {
        pendingCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        cancelledCount: 0,
        acceptedSeats: 0,
        totalBookings: 0,
      };
    }

    if (status === "pending") statsByRide[rideId].pendingCount = count;

    if (status === "accepted") {
      statsByRide[rideId].acceptedCount = count;
      statsByRide[rideId].acceptedSeats = seats;
    }

    if (status === "rejected") statsByRide[rideId].rejectedCount = count;
    if (status === "cancelled") statsByRide[rideId].cancelledCount = count;

    statsByRide[rideId].totalBookings += count;
  }

  const acceptedByRide = {};
  for (const booking of acceptedBookings) {
    if (!acceptedByRide[booking.rideId]) {
      acceptedByRide[booking.rideId] = [];
    }
    acceptedByRide[booking.rideId].push(booking);
  }

  // attach stats + reshape pickup/dropoff
  return rides.map((r) => ({
    ...r,
    pickup: { address: r.pickupAddress, lat: r.pickupLat, lng: r.pickupLng },
    dropoff: {
      address: r.dropoffAddress,
      lat: r.dropoffLat,
      lng: r.dropoffLng,
    },
    meetupPoints: normalizeMeetupPoints(r),
    acceptedBookings: acceptedByRide[r.id] || [],
    analytics: statsByRide[r.id] || {
      pendingCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      cancelledCount: 0,
      acceptedSeats: 0,
      totalBookings: 0,
    },
  }));
};

const cancelRide = async (driverId, rideId) => {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });

  if (!ride) {
    const err = new Error("Ride not found");
    err.statusCode = 404;
    throw err;
  }

  if (ride.driverId !== driverId) {
    const err = new Error("Not authorized to cancel this ride");
    err.statusCode = 403;
    throw err;
  }

  if (!["active", "ready"].includes(ride.status)) {
    const err = new Error("Only active or ready rides can be cancelled");
    err.statusCode = 400;
    throw err;
  }

  // ✅ transaction: cancel ride + cascade cancel bookings
  const updatedRide = await prisma.$transaction(async (tx) => {
    const r = await tx.ride.update({
      where: { id: rideId },
      data: { status: "cancelled" },
    });

    await tx.booking.updateMany({
      where: {
        rideId,
        status: { in: ["pending", "accepted"] },
      },
      data: { status: "cancelled" },
    });

    return r;
  });

  // reshape pickup/dropoff for response
  return {
    ...updatedRide,
    pickup: {
      address: updatedRide.pickupAddress,
      lat: updatedRide.pickupLat,
      lng: updatedRide.pickupLng,
    },
    dropoff: {
      address: updatedRide.dropoffAddress,
      lat: updatedRide.dropoffLat,
      lng: updatedRide.dropoffLng,
    },
  };
};

// ─── Real-time Tracking ───────────────────────────────────────────────────────

const ROUTE_DEVIATION_THRESHOLD_METERS = 200;

function getRouteDeviationInfo(lat, lng, encodedPolyline) {
  let isDeviated = false;
  let distanceFromRoute = null;
  let routeStatus = "on_route";

  if (!encodedPolyline) {
    return { isDeviated, distanceFromRoute, routeStatus };
  }

  try {
    const polyline = JSON.parse(encodedPolyline);
    if (Array.isArray(polyline) && polyline.length >= 2) {
      distanceFromRoute = minDistanceToPolylineMeters(lat, lng, polyline);
      isDeviated = distanceFromRoute > ROUTE_DEVIATION_THRESHOLD_METERS;
      routeStatus = isDeviated ? "deviated" : "on_route";
    }
  } catch (_) {
    // skip deviation check if polyline is invalid
  }

  return { isDeviated, distanceFromRoute, routeStatus };
}

/**
 * Driver calls this every ~15 seconds to broadcast their position.
 * Returns deviation info so passenger can be alerted.
 */
const updateDriverLocation = async (driverId, rideId, lat, lng) => {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });

  if (!ride) {
    throw Object.assign(new Error("Ride not found"), { statusCode: 404 });
  }

  if (ride.driverId !== driverId) {
    throw Object.assign(new Error("Not authorized"), { statusCode: 403 });
  }

  if (!["ready", "in_progress"].includes(ride.status)) {
    throw Object.assign(
      new Error("Ride must have accepted passengers before going live"),
      { statusCode: 400 },
    );
  }

  const nextStatus = ride.status === "ready" ? "in_progress" : ride.status;

  // Update location in DB and auto-start ride if needed
  await prisma.ride.update({
    where: { id: rideId },
    data: {
      currentLat: lat,
      currentLng: lng,
      lastUpdate: new Date(),
      status: nextStatus,
    },
  });

  const deviation = getRouteDeviationInfo(lat, lng, ride.encodedPolyline);

  return { lat, lng, ...deviation };
};

/**
 * Passenger polls this to get the driver's latest position.
 */
const getDriverLocation = async (rideId) => {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      currentLat: true,
      currentLng: true,
      lastUpdate: true,
      status: true,
      encodedPolyline: true,
    },
  });

  if (!ride)
    throw Object.assign(new Error("Ride not found"), { statusCode: 404 });

  const deviation =
    ride.currentLat != null && ride.currentLng != null
      ? getRouteDeviationInfo(
          ride.currentLat,
          ride.currentLng,
          ride.encodedPolyline,
        )
      : { isDeviated: false, distanceFromRoute: null, routeStatus: "on_route" };

  return {
    lat: ride.currentLat,
    lng: ride.currentLng,
    lastUpdate: ride.lastUpdate,
    status: ride.status,
    ...deviation,
  };
};

/**
 * Mark a ride as completed (driver only).
 */
async function completeRide(driverId, rideId) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });

  if (!ride) {
    throw Object.assign(new Error("Ride not found"), { statusCode: 404 });
  }

  if (ride.driverId !== driverId) {
    throw Object.assign(new Error("Not authorized"), { statusCode: 403 });
  }

  if (ride.status !== "in_progress") {
    throw Object.assign(
      new Error("Only an in-progress ride can be completed"),
      { statusCode: 400 },
    );
  }

  const updated = await prisma.ride.update({
    where: { id: rideId },
    data: { status: "completed" },
  });

  return updated;
}

/**
 * Delete a completed or cancelled ride (driver only).
 * Cascades: deletes reviews → bookings → ride.
 */
async function deleteRide(driverId, rideId) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });

  if (!ride)
    throw Object.assign(new Error("Ride not found"), { statusCode: 404 });
  if (ride.driverId !== driverId)
    throw Object.assign(new Error("Not authorized"), { statusCode: 403 });
  if (ride.status === "active") {
    throw Object.assign(
      new Error("Cannot delete an active ride. Cancel it first."),
      { statusCode: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.deleteMany({ where: { rideId } });
    await tx.booking.deleteMany({ where: { rideId } });
    await tx.ride.delete({ where: { id: rideId } });
  });

  return { deleted: true, rideId };
}

const getRideById = async (rideId, viewer = {}) => {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          vehicle: {
            select: {
              avgKmPerLitre: true,
            },
          },
          reviewsGot: {
            select: { rating: true },
          },
        },
      },
      bookings: {
        where: { status: "accepted" },
        select: {
          seatsRequested: true,
          meetupPoint: true,
          passenger: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
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

  if (
    ride.femaleOnly &&
    viewer.role !== "admin" &&
    viewer.role !== "driver" &&
    viewer.gender !== "female"
  ) {
    const err = new Error("Ride not found");
    err.statusCode = 404;
    throw err;
  }

  const acceptedSeats = ride.bookings.reduce(
    (sum, booking) => sum + booking.seatsRequested,
    0,
  );

  const seatsAvailable = Math.max(ride.seatsTotal - acceptedSeats, 0);

  const ratings = ride.driver.reviewsGot || [];
  const totalReviews = ratings.length;
  const avgRating =
    totalReviews > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : null;

  const pricingSettings = await getPricingSettings();
  const fareBreakdown = buildFareBreakdown({
    distanceMeters: ride.distanceMeters,
    seatsTotal: ride.seatsTotal,
    avgKmPerLitre: ride.driver.vehicle?.avgKmPerLitre,
    fuelPricePerLitre: pricingSettings.fuelPricePerLitre,
  });
  const meetupPoints = normalizeMeetupPoints(ride);

  return {
    ...ride,
    driver: {
      ...ride.driver,
      avgRating,
      totalReviews,
    },
    seatsAvailable,
    fareBreakdown,
    meetupPoints,
    sharedRouteRide: true,
    femaleOnly: ride.femaleOnly,
    pickup: {
      address: ride.pickupAddress,
      lat: ride.pickupLat,
      lng: ride.pickupLng,
    },
    dropoff: {
      address: ride.dropoffAddress,
      lat: ride.dropoffLat,
      lng: ride.dropoffLng,
    },
    acceptedBookings: ride.bookings || [],
  };
};

module.exports = {
  createRide,
  listActiveRides,
  listDriverRides,
  getRideById,
  cancelRide,
  updateDriverLocation,
  getDriverLocation,
  completeRide,
  deleteRide,
};
