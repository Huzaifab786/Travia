const prisma = require("../config/db");
const { emitUserNotification } = require("../services/notificationService");
const {
  normalizeTripPlace,
  buildRouteSignatureFromPlaces,
  buildRouteLabelSignatureFromPlaces,
  buildRouteExactSignatureFromPlaces,
  getPassRideCount,
  getRouteLabel,
  getPlanPrice,
  getPassDurationLabel,
  isPassCurrentlyActive,
  getPassExpiryStatus,
} = require("../services/passService");

function buildRouteKey(driverId, routeSignature) {
  return `${driverId}:${routeSignature}`;
}

function routePairMatchesPass(pass, routePickup, routeDropoff) {
  if (!pass) return false;

  const currentExact = buildRouteExactSignatureFromPlaces(
    routePickup,
    routeDropoff,
  );
  const storedExact = buildRouteExactSignatureFromPlaces(
    pass.routePickup,
    pass.routeDropoff,
  );

  if (currentExact && storedExact) {
    return currentExact === storedExact;
  }

  const currentLabel = buildRouteLabelSignatureFromPlaces(
    routePickup,
    routeDropoff,
  );
  const storedLabel = buildRouteLabelSignatureFromPlaces(
    pass.routePickup,
    pass.routeDropoff,
  );

  const currentCoordinate = buildRouteSignatureFromPlaces(
    routePickup,
    routeDropoff,
  );
  const storedCoordinate = buildRouteSignatureFromPlaces(
    pass.routePickup,
    pass.routeDropoff,
  );

  return (
    (currentLabel && storedLabel && currentLabel === storedLabel) ||
    (currentCoordinate && storedCoordinate && currentCoordinate === storedCoordinate) ||
    (pass.routeSignature && (pass.routeSignature === currentExact || pass.routeSignature === currentLabel || pass.routeSignature === currentCoordinate))
  );
}

function buildRouteKeyVariants(driverId, routePickup, routeDropoff) {
  const routeExactSignature = buildRouteExactSignatureFromPlaces(
    routePickup,
    routeDropoff,
  );
  const routeLabelSignature = buildRouteLabelSignatureFromPlaces(
    routePickup,
    routeDropoff,
  );
  const routeCoordinateSignature = buildRouteSignatureFromPlaces(
    routePickup,
    routeDropoff,
  );

  return {
    routeExactSignature,
    routeLabelSignature,
    routeCoordinateSignature,
    keys: [
      routeExactSignature ? buildRouteKey(driverId, routeExactSignature) : null,
      routeLabelSignature ? buildRouteKey(driverId, routeLabelSignature) : null,
      routeCoordinateSignature
        ? buildRouteKey(driverId, routeCoordinateSignature)
        : null,
    ].filter(Boolean),
  };
}

function shapePlace(place) {
  if (!place) return null;
  return {
    id: place.id || null,
    label: place.label || place.address || "Trip point",
    address: place.address || place.label || null,
    lat: Number(place.lat),
    lng: Number(place.lng),
  };
}

function shapePass(pass) {
  const status = getPassExpiryStatus(pass);
  return {
    ...pass,
    status,
    routePickup: pass.routePickup || null,
    routeDropoff: pass.routeDropoff || null,
    routeLabel: getRouteLabel(pass.routePickup, pass.routeDropoff),
    durationLabel: getPassDurationLabel(pass.planType, pass.durationDays),
  };
}

async function getEligibleRouteGroups(passengerId) {
  const existingPasses = await prisma.commuterPass.findMany({
    where: {
      passengerId,
      status: { in: ["pending", "active"] },
    },
    select: {
      driverId: true,
      routeSignature: true,
      routePickup: true,
      routeDropoff: true,
    },
  });

  const completedBookings = await prisma.booking.findMany({
    where: {
      passengerId,
      OR: [{ status: "dropped_off" }, { ride: { status: "completed" } }],
    },
    include: {
      ride: {
        include: {
          driver: {
            select: { id: true, name: true, avatarUrl: true, phone: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = {};

  for (const booking of completedBookings) {
    const driver = booking.ride?.driver;
    const routePickup = normalizeTripPlace(booking.passengerPickup);
    const routeDropoff = normalizeTripPlace(booking.passengerDropoff);
    const { routeExactSignature, routeLabelSignature, routeCoordinateSignature, keys } =
      buildRouteKeyVariants(driver?.id, routePickup, routeDropoff);

    if (!driver || keys.length === 0 || !routeExactSignature) {
      continue;
    }

    const alreadyHasPass = existingPasses.some(
      (pass) =>
        pass.driverId === driver.id &&
        routePairMatchesPass(pass, routePickup, routeDropoff),
    );

    if (alreadyHasPass) {
      continue;
    }

    const preferredKey = keys[0];
    if (!groups[preferredKey]) {
      groups[preferredKey] = {
        driver,
        routeSignature: routeExactSignature,
        routeLabelSignature,
        legacyRouteSignature: routeCoordinateSignature,
        routePickup,
        routeDropoff,
        completedTrips: 0,
        fareSum: 0,
        lastTripAt: booking.createdAt,
      };
    }

    const group = groups[preferredKey];
    group.completedTrips += 1;
    group.fareSum += Number(booking.ride?.price || 0);
    group.lastTripAt = booking.createdAt;

    if (!group.legacyRouteSignature && routeCoordinateSignature) {
      group.legacyRouteSignature = routeCoordinateSignature;
    }
  }

  return Object.values(groups)
    .filter((group) => group.completedTrips >= 3)
    .map((group) => ({
      driver: group.driver,
      routeSignature: group.routeSignature,
      routeLabelSignature: group.routeLabelSignature || null,
      legacyRouteSignature: group.legacyRouteSignature || null,
      routePickup: shapePlace(group.routePickup),
      routeDropoff: shapePlace(group.routeDropoff),
      routeLabel: getRouteLabel(group.routePickup, group.routeDropoff),
      completedTrips: group.completedTrips,
      estimatedFarePerRide: Math.round(group.fareSum / group.completedTrips),
      lastTripAt: group.lastTripAt,
    }))
    .sort((a, b) => b.completedTrips - a.completedTrips);
}

// Same driver + same route only
const getEligibleDrivers = async (req, res) => {
  try {
    const passengerId = req.user.id;
    const eligibleRoutes = await getEligibleRouteGroups(passengerId);
    res.json({ data: eligibleRoutes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch eligible routes" });
  }
};

const getPassengerActivePasses = async (req, res) => {
  try {
    const passengerId = req.user.id;
    const passes = await prisma.commuterPass.findMany({
      where: { passengerId },
      include: {
        driver: {
          select: { id: true, name: true, avatarUrl: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: passes.map(shapePass) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch active passes" });
  }
};

const requestPass = async (req, res) => {
  try {
    const passengerId = req.user.id;
    const { driverId, routeSignature, planType, durationDays } = req.body;

    if (!driverId || !routeSignature || !planType) {
      return res.status(400).json({
        error: "driverId, routeSignature, and planType are required.",
      });
    }

    const normalizedPlanType = String(planType).toLowerCase();
    const rideCount = getPassRideCount(normalizedPlanType, durationDays);

    if (!rideCount) {
      return res
        .status(400)
        .json({ error: "durationDays must be a positive number." });
    }

    const eligibleRoutes = await getEligibleRouteGroups(passengerId);
    const eligibleRoute = eligibleRoutes.find(
      (route) =>
        route.driver.id === driverId &&
        (route.routeSignature === routeSignature ||
          route.routeLabelSignature === routeSignature ||
          route.legacyRouteSignature === routeSignature),
    );

    if (!eligibleRoute) {
      return res
        .status(400)
        .json({ error: "This route is not eligible for a commuter pass yet." });
    }

    const existing = await prisma.commuterPass.findFirst({
      where: {
        passengerId,
        driverId,
        OR: eligibleRoute
          ? [
              { routeSignature: eligibleRoute.routeSignature },
              { routeSignature: eligibleRoute.routeLabelSignature || routeSignature },
              {
                routeSignature: eligibleRoute.legacyRouteSignature || routeSignature,
              },
            ]
          : [{ routeSignature }],
        status: { in: ["pending", "active"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing && (existing.status === "pending" || isPassCurrentlyActive(existing))) {
      return res.status(400).json({
        error: "You already have a pending or active pass for this route.",
      });
    }

    const now = new Date();
    const price = getPlanPrice(eligibleRoute.estimatedFarePerRide, rideCount);
    const pass = await prisma.commuterPass.create({
      data: {
        passengerId,
        driverId,
        status: "pending",
        planType: normalizedPlanType,
        durationDays: rideCount,
        startDate: now,
        endDate: null,
        routeSignature: eligibleRoute.routeSignature,
        routePickup: eligibleRoute.routePickup,
        routeDropoff: eligibleRoute.routeDropoff,
        totalRides: rideCount,
        ridesUsed: 0,
        price,
      },
      include: {
        driver: {
          select: { id: true, name: true, avatarUrl: true, phone: true },
        },
      },
    });

    try {
      emitUserNotification({
        userId: driverId,
        title: "New commuter pass request",
        body: `${req.user.name || "A passenger"} requested a pass for ${eligibleRoute.routeLabel}.`,
        type: "pass_request",
        data: {
          passId: pass.id,
          passengerId,
          driverId,
          routeSignature: eligibleRoute.routeSignature,
        },
      });
    } catch (e) {
      console.error("Notification error", e);
    }

    res.status(201).json({ data: shapePass(pass) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to request pass" });
  }
};

const getDriverPasses = async (req, res) => {
  try {
    const driverId = req.user.id;
    const passes = await prisma.commuterPass.findMany({
      where: { driverId },
      include: {
        passenger: {
          select: { id: true, name: true, avatarUrl: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: passes.map(shapePass) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch driver passes" });
  }
};

const approvePass = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { id } = req.params;

    const pass = await prisma.commuterPass.findUnique({
      where: { id },
    });

    if (!pass || pass.driverId !== driverId) {
      return res.status(404).json({ error: "Pass not found" });
    }

    if (pass.status !== "pending") {
      return res.status(400).json({ error: "Pass is not pending approval" });
    }

    const updatedPass = await prisma.commuterPass.update({
      where: { id },
      data: { status: "active" },
      include: {
        passenger: {
          select: { id: true, name: true, avatarUrl: true, phone: true },
        },
      },
    });

    try {
      emitUserNotification({
        userId: pass.passengerId,
        title: "Commuter pass approved",
        body: `${req.user.name || "Your driver"} approved your pass for ${getRouteLabel(pass.routePickup, pass.routeDropoff)}.`,
        type: "pass_approved",
        data: {
          passId: pass.id,
          driverId,
          routeSignature: pass.routeSignature,
        },
      });
    } catch (e) {
      console.error("Notification error", e);
    }

    res.json({ data: shapePass(updatedPass) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to approve pass" });
  }
};

module.exports = {
  getEligibleDrivers,
  getPassengerActivePasses,
  requestPass,
  getDriverPasses,
  approvePass,
};
