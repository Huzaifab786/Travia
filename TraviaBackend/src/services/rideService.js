const prisma = require("../config/db");
const { getRouteBetweenPoints } = require("./routeService");

const createRide = async (driverId, payload) => {
  const { pickup, dropoff, departureTime, seatsTotal, notes } = payload;

  // 1. Fetch driver's vehicle info for cost-sharing calculation
  const vehicle = await prisma.vehicle.findUnique({
    where: { userId: driverId },
  });

  if (!vehicle) {
    const err = new Error("Please set up your vehicle details first (Car Model, Fuel Average, etc.) to calculate shared costs.");
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch route to get geometry and distance
  const route = await getRouteBetweenPoints(
    { lat: Number(pickup.lat), lng: Number(pickup.lng) },
    { lat: Number(dropoff.lat), lng: Number(dropoff.lng) }
  );

  const distanceMeters = route.distanceMeters || 0;
  const durationSeconds = route.durationSeconds || 0;
  
  // Store coordinates for polyline visualization
  const encodedPolyline = JSON.stringify(route.coordinates);

  // 3. Pure Cost-Sharing Logic (FYP Requirement)
  // Distance in KM
  const distanceKm = distanceMeters / 1000;
  
  // Total Fuel Cost = (Distance / Fuel Avg) * Fuel Price
  const totalFuelCost = (distanceKm / vehicle.avgKmPerLitre) * vehicle.fuelPricePerLitre;
  
  // Shared Cost per Seat = Total Fuel Cost / (Seats Offered + Driver)
  // This ensures the driver is also a stakeholder in the cost sharing.
  const seatsCount = Number(seatsTotal);
  const totalTravelers = seatsCount + 1; // including driver
  const sharedPricePerSeat = Math.round(totalFuelCost / totalTravelers);
  
  // Minimum floor price to avoid zero or trivial costs (e.g. 20 Rs)
  const finalPrice = Math.max(20, sharedPricePerSeat);

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
      status: "active",
      encodedPolyline,
      distanceMeters,
      durationSeconds,
    },
  });

  return ride;
};

const listActiveRides = async () => {
  const rides = await prisma.ride.findMany({
    where: { status: "active" },
    orderBy: { departureTime: "asc" },
    include: {
      driver: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // shape to match your frontend (pickup/dropoff objects)
  return rides.map((r) => ({
    ...r,
    pickup: { address: r.pickupAddress, lat: r.pickupLat, lng: r.pickupLng },
    dropoff: {
      address: r.dropoffAddress,
      lat: r.dropoffLat,
      lng: r.dropoffLng,
    },
  }));
};

const listDriverRides = async (driverId) => {
  const rides = await prisma.ride.findMany({
    where: { driverId },
    orderBy: { createdAt: "desc" },
  });

  const rideIds = rides.map((r) => r.id);

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

  // attach stats + reshape pickup/dropoff
  return rides.map((r) => ({
    ...r,
    pickup: { address: r.pickupAddress, lat: r.pickupLat, lng: r.pickupLng },
    dropoff: {
      address: r.dropoffAddress,
      lat: r.dropoffLat,
      lng: r.dropoffLng,
    },
    analytics:
      statsByRide[r.id] || {
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

  if (ride.status !== "active") {
    const err = new Error("Ride already cancelled or completed");
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

/**
 * Haversine formula: distance in meters between two lat/lng points.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Minimum distance from a point to any segment of a polyline (array of {lat, lng}).
 */
function minDistanceToPolyline(lat, lng, polyline) {
  if (!polyline || polyline.length < 2) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentDistance(lat, lng, polyline[i], polyline[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function pointToSegmentDistance(lat, lng, a, b) {
  // Simple approximation: find closest distance from point to the two endpoints
  const d1 = haversineDistance(lat, lng, a.lat, a.lng);
  const d2 = haversineDistance(lat, lng, b.lat, b.lng);
  return Math.min(d1, d2);
}

/**
 * Driver calls this every ~15 seconds to broadcast their position.
 * Returns deviation info so passenger can be alerted.
 */
const updateDriverLocation = async (driverId, rideId, lat, lng) => {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });

  if (!ride) throw Object.assign(new Error("Ride not found"), { statusCode: 404 });
  if (ride.driverId !== driverId) throw Object.assign(new Error("Not authorized"), { statusCode: 403 });
  if (ride.status !== "active") throw Object.assign(new Error("Ride is not active"), { statusCode: 400 });

  // Update location in DB
  await prisma.ride.update({
    where: { id: rideId },
    data: { currentLat: lat, currentLng: lng, lastUpdate: new Date() },
  });

  // Deviation check using stored polyline
  const DEVIATION_THRESHOLD_METERS = 500;
  let isDeviated = false;
  let distanceFromRoute = null;

  if (ride.encodedPolyline) {
    try {
      const polyline = JSON.parse(ride.encodedPolyline);
      distanceFromRoute = minDistanceToPolyline(lat, lng, polyline);
      isDeviated = distanceFromRoute > DEVIATION_THRESHOLD_METERS;
    } catch (_) {
      // If polyline parse fails, skip deviation check
    }
  }

  return { lat, lng, isDeviated, distanceFromRoute };
};

/**
 * Passenger polls this to get the driver's latest position.
 */
const getDriverLocation = async (rideId) => {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: { currentLat: true, currentLng: true, lastUpdate: true, status: true, encodedPolyline: true },
  });

  if (!ride) throw Object.assign(new Error("Ride not found"), { statusCode: 404 });

  let isDeviated = false;
  let distanceFromRoute = null;

  if (ride.currentLat != null && ride.currentLng != null && ride.encodedPolyline) {
    try {
      const polyline = JSON.parse(ride.encodedPolyline);
      distanceFromRoute = minDistanceToPolyline(ride.currentLat, ride.currentLng, polyline);
      const DEVIATION_THRESHOLD_METERS = 500;
      isDeviated = distanceFromRoute > DEVIATION_THRESHOLD_METERS;
    } catch (_) {
      // silent
    }
  }

  return {
    lat: ride.currentLat,
    lng: ride.currentLng,
    lastUpdate: ride.lastUpdate,
    status: ride.status,
    isDeviated,
    distanceFromRoute,
  };
};

/**
 * Mark a ride as completed (driver only).
 */
async function completeRide(driverId, rideId) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) throw Object.assign(new Error("Ride not found"), { statusCode: 404 });
  if (ride.driverId !== driverId) throw Object.assign(new Error("Not authorized"), { statusCode: 403 });

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

  if (!ride) throw Object.assign(new Error("Ride not found"), { statusCode: 404 });
  if (ride.driverId !== driverId) throw Object.assign(new Error("Not authorized"), { statusCode: 403 });
  if (ride.status === "active") {
    throw Object.assign(
      new Error("Cannot delete an active ride. Cancel it first."),
      { statusCode: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.review.deleteMany({ where: { rideId } });
    await tx.booking.deleteMany({ where: { rideId } });
    await tx.ride.delete({ where: { id: rideId } });
  });

  return { deleted: true, rideId };
}

module.exports = {
  createRide,
  listActiveRides,
  listDriverRides,
  cancelRide,
  updateDriverLocation,
  getDriverLocation,
  completeRide,
  deleteRide,
};