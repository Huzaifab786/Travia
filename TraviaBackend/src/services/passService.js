const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeNumber(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

function normalizeRouteText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function buildRouteSignatureFromPlaces(passengerPickup, passengerDropoff) {
  const pickup = normalizeTripPlace(passengerPickup);
  const dropoff = normalizeTripPlace(passengerDropoff);

  if (!pickup || !dropoff) {
    return null;
  }

  const pickupLat = normalizeNumber(pickup.lat);
  const pickupLng = normalizeNumber(pickup.lng);
  const dropoffLat = normalizeNumber(dropoff.lat);
  const dropoffLng = normalizeNumber(dropoff.lng);

  if (
    pickupLat == null ||
    pickupLng == null ||
    dropoffLat == null ||
    dropoffLng == null
  ) {
    return null;
  }

  return `${pickupLat},${pickupLng}|${dropoffLat},${dropoffLng}`;
}

function buildRouteLabelSignatureFromPlaces(passengerPickup, passengerDropoff) {
  const pickup = normalizeTripPlace(passengerPickup);
  const dropoff = normalizeTripPlace(passengerDropoff);

  if (!pickup || !dropoff) {
    return null;
  }

  const pickupLabel = normalizeRouteText(pickup.label || pickup.address);
  const dropoffLabel = normalizeRouteText(dropoff.label || dropoff.address);

  if (!pickupLabel || !dropoffLabel) {
    return null;
  }

  return `${pickupLabel}|${dropoffLabel}`;
}

function buildRouteExactSignatureFromPlaces(passengerPickup, passengerDropoff) {
  const pickup = normalizeTripPlace(passengerPickup);
  const dropoff = normalizeTripPlace(passengerDropoff);

  if (!pickup || !dropoff) {
    return null;
  }

  const pickupLabel = normalizeRouteText(pickup.label || pickup.address);
  const dropoffLabel = normalizeRouteText(dropoff.label || dropoff.address);
  const pickupLat = normalizeNumber(pickup.lat);
  const pickupLng = normalizeNumber(pickup.lng);
  const dropoffLat = normalizeNumber(dropoff.lat);
  const dropoffLng = normalizeNumber(dropoff.lng);

  if (
    !pickupLabel ||
    !dropoffLabel ||
    pickupLat == null ||
    pickupLng == null ||
    dropoffLat == null ||
    dropoffLng == null
  ) {
    return null;
  }

  return `${pickupLabel}:${pickupLat},${pickupLng}|${dropoffLabel}:${dropoffLat},${dropoffLng}`;
}

function buildRouteMatchKeysFromPlaces(passengerPickup, passengerDropoff) {
  return {
    routeExactSignature: buildRouteExactSignatureFromPlaces(
      passengerPickup,
      passengerDropoff,
    ),
    routeLabelSignature: buildRouteLabelSignatureFromPlaces(
      passengerPickup,
      passengerDropoff,
    ),
    routeCoordinateSignature: buildRouteSignatureFromPlaces(
      passengerPickup,
      passengerDropoff,
    ),
  };
}

function getPassRideCount(planType, durationDays) {
  const normalizedPlan = String(planType || "").toLowerCase();

  if (normalizedPlan === "weekly") return 7;
  if (normalizedPlan === "monthly") return 30;

  const days = Math.max(1, Math.floor(Number(durationDays || 0)));
  if (!Number.isFinite(days) || days <= 0) {
    return null;
  }

  return days;
}

function getPlanTypeDays(planType, durationDays) {
  return getPassRideCount(planType, durationDays);
}

function isPassCurrentlyActive(pass, now = new Date()) {
  if (!pass || pass.status !== "active") {
    return false;
  }

  const totalRides = Number(pass.totalRides || 0);
  const ridesUsed = Number(pass.ridesUsed || 0);

  if (totalRides > 0 && ridesUsed >= totalRides) {
    return false;
  }

  return true;
}

function getPassExpiryStatus(pass, now = new Date()) {
  if (!pass) return "cancelled";

  if (pass.status === "cancelled") return "cancelled";
  if (pass.status === "pending") return "pending";

  const totalRides = Number(pass.totalRides || 0);
  const ridesUsed = Number(pass.ridesUsed || 0);

  if (pass.status === "active" && totalRides > 0 && ridesUsed >= totalRides) {
    return "exhausted";
  }

  return pass.status;
}

function getRouteLabel(routePickup, routeDropoff) {
  const pickupLabel = routePickup?.label || routePickup?.address || "Pickup";
  const dropoffLabel = routeDropoff?.label || routeDropoff?.address || "Dropoff";
  return `${pickupLabel} -> ${dropoffLabel}`;
}

function getPlanPrice(baseFare, durationDays) {
  const fare = Number(baseFare || 0);
  const days = Math.max(1, Math.floor(Number(durationDays || 0)));
  return Math.max(20, Math.round(fare * days * 0.9));
}

function getPassDurationLabel(planType, durationDays) {
  const normalizedPlan = String(planType || "").toLowerCase();
  if (normalizedPlan === "weekly") return "Weekly";
  if (normalizedPlan === "monthly") return "Monthly";
  const rides = Math.max(1, Math.floor(Number(durationDays || 0)));
  return `${rides} ride${rides === 1 ? "" : "s"}`;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

module.exports = {
  normalizeTripPlace,
  normalizeRouteText,
  buildRouteSignatureFromPlaces,
  buildRouteLabelSignatureFromPlaces,
  buildRouteExactSignatureFromPlaces,
  buildRouteMatchKeysFromPlaces,
  getPassRideCount,
  getPlanTypeDays,
  isPassCurrentlyActive,
  getPassExpiryStatus,
  getRouteLabel,
  getPlanPrice,
  getPassDurationLabel,
  addDays,
};
