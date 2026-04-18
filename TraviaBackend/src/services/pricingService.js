const prisma = require("../config/db");
const {
  projectPointToPolylineMeters,
  polylineLengthMeters,
} = require("./routeService");

const DEFAULT_FUEL_PRICE = 270;
const MINIMUM_FARE = 20;

let cachedPricingSettings = null;
let pricingSettingsPromise = null;

function cachePricingSettings(settings) {
  cachedPricingSettings = settings ? { ...settings } : null;
  return cachedPricingSettings;
}

async function getPricingSettings() {
  if (cachedPricingSettings) {
    return cachedPricingSettings;
  }

  if (pricingSettingsPromise) {
    return pricingSettingsPromise;
  }

  pricingSettingsPromise = (async () => {
    let settings = await prisma.pricingSetting.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!settings) {
      settings = await prisma.pricingSetting.create({
        data: {
          fuelPricePerLitre: DEFAULT_FUEL_PRICE,
          routeRadiusKm: 15,
        },
      });
    } else if (settings.routeRadiusKm <= 5) {
      // Auto-upgrade from old default of 5km to 15km
      settings = await prisma.pricingSetting.update({
        where: { id: settings.id },
        data: { routeRadiusKm: 15 },
      });
    }

    return cachePricingSettings(settings);
  })();

  try {
    return await pricingSettingsPromise;
  } finally {
    pricingSettingsPromise = null;
  }
}

async function updatePricingSettings(data) {
  const fuelPricePerLitre = Number(data?.fuelPricePerLitre);
  const routeRadiusKm = Number(data?.routeRadiusKm);

  if (!Number.isFinite(fuelPricePerLitre) || fuelPricePerLitre <= 0) {
    const err = new Error("Fuel price per litre must be a positive number");
    err.statusCode = 400;
    throw err;
  }

  if (
    !Number.isFinite(routeRadiusKm) ||
    routeRadiusKm < 2 ||
    routeRadiusKm > 30
  ) {
    const err = new Error("Route radius must be between 2 and 30 km");
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.pricingSetting.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!existing) {
    const settings = await prisma.pricingSetting.create({
      data: {
        fuelPricePerLitre,
        routeRadiusKm,
      },
    });

    return cachePricingSettings(settings);
  }

  const settings = await prisma.pricingSetting.update({
    where: { id: existing.id },
    data: {
      fuelPricePerLitre,
      routeRadiusKm,
    },
  });

  return cachePricingSettings(settings);
}

function calculateSharedFare({
  distanceMeters,
  seatsTotal,
  avgKmPerLitre,
  fuelPricePerLitre,
}) {
  const distanceKm = Number(distanceMeters || 0) / 1000;
  const seatsCount = Number(seatsTotal || 0);
  const fuelAverage = Number(avgKmPerLitre || 0);
  const fuelPrice = Number(fuelPricePerLitre || 0);

  if (!Number.isFinite(fuelAverage) || fuelAverage <= 0) {
    const err = new Error("Vehicle fuel average must be greater than 0");
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isFinite(fuelPrice) || fuelPrice <= 0) {
    const err = new Error("Fuel price must be greater than 0");
    err.statusCode = 400;
    throw err;
  }

  const totalFuelCost = (distanceKm / fuelAverage) * fuelPrice;
  const totalTravelers = seatsCount + 1;
  const sharedPricePerSeat = Math.round(totalFuelCost / totalTravelers);
  const finalPrice = Math.max(MINIMUM_FARE, sharedPricePerSeat);

  return {
    distanceKm,
    totalTravelers,
    fuelAverage,
    fuelPricePerLitre: fuelPrice,
    totalFuelCost,
    sharedPricePerSeat,
    minimumFare: MINIMUM_FARE,
    finalPrice,
  };
}

function buildPassengerTripQuote({
  ridePolyline,
  rideDistanceMeters,
  driverPickup,
  driverDropoff,
  passengerPickup,
  passengerDropoff,
  seatsTotal,
  avgKmPerLitre,
  fuelPricePerLitre,
  routeRadiusKm = 5,
}) {
  const pickupLat = Number(passengerPickup?.lat);
  const pickupLng = Number(passengerPickup?.lng);
  const dropoffLat = Number(passengerDropoff?.lat);
  const dropoffLng = Number(passengerDropoff?.lng);

  if (
    !Number.isFinite(pickupLat) ||
    !Number.isFinite(pickupLng) ||
    !Number.isFinite(dropoffLat) ||
    !Number.isFinite(dropoffLng)
  ) {
    const err = new Error("Passenger pickup and dropoff coordinates are required");
    err.statusCode = 400;
    throw err;
  }

  const fallbackPolyline = Array.isArray(ridePolyline) && ridePolyline.length >= 2
    ? ridePolyline
    : null;

  const driverPolyline =
    fallbackPolyline || [
      driverPickup || null,
      driverDropoff || null,
    ].filter(p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));

  const polyline =
    Array.isArray(driverPolyline) && driverPolyline.length >= 2
      ? driverPolyline
      : [];

  const routeLengthMeters =
    Number(rideDistanceMeters) > 0
      ? Number(rideDistanceMeters)
      : polylineLengthMeters(polyline);

  if (!routeLengthMeters || routeLengthMeters <= 0) {
    const err = new Error("Ride route is unavailable for pricing");
    err.statusCode = 400;
    throw err;
  }

  const pickupProjection = projectPointToPolylineMeters(
    pickupLat,
    pickupLng,
    polyline,
  );
  const dropoffProjection = projectPointToPolylineMeters(
    dropoffLat,
    dropoffLng,
    polyline,
  );

  const maxRouteDeviationMeters = Number(routeRadiusKm || 5) * 1000;

  if (
    pickupProjection.distanceFromRouteMeters > maxRouteDeviationMeters ||
    dropoffProjection.distanceFromRouteMeters > maxRouteDeviationMeters
  ) {
    const err = new Error("Passenger trip is too far from this ride route");
    err.statusCode = 400;
    throw err;
  }

  if (
    pickupProjection.routeRatio != null &&
    dropoffProjection.routeRatio != null &&
    pickupProjection.routeRatio >= dropoffProjection.routeRatio
  ) {
    const err = new Error(
      "Passenger dropoff must come after pickup along the driver route",
    );
    err.statusCode = 400;
    throw err;
  }

  const segmentDistanceMeters = Math.max(
    0,
    dropoffProjection.distanceAlongRouteMeters -
      pickupProjection.distanceAlongRouteMeters,
  );
  const segmentDistanceKm = segmentDistanceMeters / 1000;

  const fuelAverage = Number(avgKmPerLitre || 0);
  const fuelPrice = Number(fuelPricePerLitre || 0);
  const seatsCount = Number(seatsTotal || 0);

  if (!Number.isFinite(fuelAverage) || fuelAverage <= 0) {
    const err = new Error("Vehicle fuel average must be greater than 0");
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isFinite(fuelPrice) || fuelPrice <= 0) {
    const err = new Error("Fuel price must be greater than 0");
    err.statusCode = 400;
    throw err;
  }

  const totalFuelCost = (segmentDistanceKm / fuelAverage) * fuelPrice;
  const totalTravelers = seatsCount + 1;
  const sharedPricePerSeat = Math.round(totalFuelCost / totalTravelers);
  const finalPrice = Math.max(MINIMUM_FARE, sharedPricePerSeat);

  return {
    pickup: passengerPickup,
    dropoff: passengerDropoff,
    routeLengthKm: routeLengthMeters / 1000,
    segmentDistanceKm,
    routeDeviationKm: Math.max(
      pickupProjection.distanceFromRouteMeters,
      dropoffProjection.distanceFromRouteMeters,
    ) / 1000,
    totalTravelers,
    fuelAverage,
    fuelPricePerLitre: fuelPrice,
    totalFuelCost,
    sharedPricePerSeat,
    minimumFare: MINIMUM_FARE,
    finalPrice,
    pickupDistanceKm: pickupProjection.distanceFromRouteMeters / 1000,
    dropoffDistanceKm: dropoffProjection.distanceFromRouteMeters / 1000,
    pickupRouteRatio: pickupProjection.routeRatio,
    dropoffRouteRatio: dropoffProjection.routeRatio,
  };
}

module.exports = {
  getPricingSettings,
  updatePricingSettings,
  calculateSharedFare,
  buildPassengerTripQuote,
  DEFAULT_FUEL_PRICE,
  MINIMUM_FARE,
};
