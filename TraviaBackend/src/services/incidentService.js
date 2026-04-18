const prisma = require("../config/db");
const { getIo } = require("../socket");

const incidentSelect = {
  id: true,
  kind: true,
  category: true,
  severity: true,
  status: true,
  message: true,
  locationLabel: true,
  latitude: true,
  longitude: true,
  adminNotes: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  ride: {
    select: {
      id: true,
      pickupAddress: true,
      dropoffAddress: true,
      departureTime: true,
      status: true,
      currentLat: true,
      currentLng: true,
      lastUpdate: true,
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  reporter: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  reportedUser: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  resolvedByAdmin: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

function emitIncidentEvent(eventName, incident) {
  try {
    const io = getIo();
    io.to("admin_room").emit(eventName, incident);
    io.to(`ride_${incident.rideId}`).emit(eventName, incident);
  } catch {
    // Socket server may not be initialized in some test paths.
  }
}

function formatIncident(incident) {
  if (!incident) {
    return null;
  }

  return {
    id: incident.id,
    kind: incident.kind,
    category: incident.category,
    severity: incident.severity,
    status: incident.status,
    message: incident.message,
    locationLabel: incident.locationLabel,
    latitude: incident.latitude,
    longitude: incident.longitude,
    adminNotes: incident.adminNotes,
    resolvedAt: incident.resolvedAt,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    rideId: incident.rideId,
    reporterId: incident.reporterId,
    reportedUserId: incident.reportedUserId,
    resolvedByAdminId: incident.resolvedByAdminId,
    ride: incident.ride,
    reporter: incident.reporter,
    reportedUser: incident.reportedUser,
    resolvedByAdmin: incident.resolvedByAdmin,
  };
}

function buildIncidentWhere({ kind, status }) {
  const where = {};

  if (kind && kind !== "all") {
    where.kind = kind;
  }

  if (status && status !== "all") {
    where.status = status;
  }

  return where;
}

async function assertRideParticipation({ rideId, userId, role }) {
  if (!rideId) {
    const error = new Error("rideId is required");
    error.statusCode = 400;
    throw error;
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      id: true,
      driverId: true,
      bookings: {
        select: {
          passengerId: true,
          status: true,
        },
      },
    },
  });

  if (!ride) {
    const error = new Error("Ride not found");
    error.statusCode = 404;
    throw error;
  }

  if (role === "driver") {
    if (ride.driverId !== userId) {
      const error = new Error("Only the ride driver can raise this incident");
      error.statusCode = 403;
      throw error;
    }
    return ride;
  }

  const passengerBooking = ride.bookings.find(
    (booking) =>
      booking.passengerId === userId &&
      ["accepted", "picked_up", "dropped_off"].includes(booking.status),
  );

  if (!passengerBooking) {
    const error = new Error(
      "Only passengers on an active booking can raise this incident",
    );
    error.statusCode = 403;
    throw error;
  }

  return ride;
}

async function createRideIncident({ userId, role, payload }) {
  const {
    rideId = null,
    reportedUserId = null,
    kind = "report",
    category = null,
    severity = null,
    message,
    locationLabel = null,
    latitude = null,
    longitude = null,
  } = payload || {};

  if (!rideId) {
    const error = new Error("rideId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    const error = new Error("message is required");
    error.statusCode = 400;
    throw error;
  }

  if (!["passenger", "driver"].includes(role)) {
    const error = new Error("Only passengers or drivers can raise incidents");
    error.statusCode = 403;
    throw error;
  }

  if (kind === "sos" || rideId) {
    await assertRideParticipation({ rideId, userId, role });
  }

  const incident = await prisma.rideIncident.create({
    data: {
      rideId,
      reporterId: userId,
      reportedUserId,
      kind,
      category,
      severity: severity || (kind === "sos" ? "critical" : "medium"),
      status: "open",
      message: message.trim(),
      locationLabel,
      latitude,
      longitude,
    },
    select: incidentSelect,
  });

  const formatted = formatIncident(incident);
  emitIncidentEvent("admin_incident_created", formatted);

  return {
    incident: formatted,
  };
}

async function getAdminIncidents({ kind = "all", status = "all" }) {
  const incidents = await prisma.rideIncident.findMany({
    where: buildIncidentWhere({ kind, status }),
    select: incidentSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return {
    incidents: incidents.map(formatIncident),
  };
}

async function updateAdminIncident(adminId, incidentId, payload) {
  const { status, adminNotes, severity } = payload || {};

  const existing = await prisma.rideIncident.findUnique({
    where: { id: incidentId },
    select: {
      id: true,
      status: true,
      rideId: true,
    },
  });

  if (!existing) {
    const error = new Error("Incident not found");
    error.statusCode = 404;
    throw error;
  }

  const incident = await prisma.rideIncident.update({
    where: { id: incidentId },
    data: {
      status: status || undefined,
      severity: severity || undefined,
      adminNotes: adminNotes || undefined,
      resolvedByAdminId:
        status && ["acknowledged", "resolved", "closed"].includes(status)
          ? adminId
          : undefined,
      resolvedAt:
        status && ["resolved", "closed"].includes(status)
          ? new Date()
          : undefined,
    },
    select: incidentSelect,
  });

  const formatted = formatIncident(incident);
  emitIncidentEvent("admin_incident_updated", formatted);

  return {
    incident: formatted,
  };
}

async function getIncidentCounts() {
  const [openIncidents, openSosAlerts, openReports, criticalAlerts] =
    await Promise.all([
      prisma.rideIncident.count({
        where: { status: { notIn: ["resolved", "closed"] } },
      }),
      prisma.rideIncident.count({
        where: { kind: "sos", status: { notIn: ["resolved", "closed"] } },
      }),
      prisma.rideIncident.count({
        where: { kind: "report", status: { notIn: ["resolved", "closed"] } },
      }),
      prisma.rideIncident.count({
        where: {
          kind: "sos",
          severity: "critical",
          status: { notIn: ["resolved", "closed"] },
        },
      }),
    ]);

  return {
    openIncidents,
    openSafetyAlerts: openSosAlerts,
    openReports,
    criticalIncidents: criticalAlerts,
  };
}

module.exports = {
  createRideIncident,
  getAdminIncidents,
  updateAdminIncident,
  getIncidentCounts,
  formatIncident,
};
