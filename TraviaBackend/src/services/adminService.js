const prisma = require("../config/db");
const supabaseAdmin = require("../config/supabaseAdmin");
const {
  getDriverVerificationDetail,
  reviewDriverVerification,
  formatVerification,
} = require("./driverVerificationService");

const getCurrentAdmin = async (adminId) => {
  const user = await prisma.user.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user || user.role !== "admin") {
    const err = new Error("Admin not found");
    err.statusCode = 404;
    throw err;
  }

  return { user };
};

/** Get dashboard stats */
const getStats = async () => {
  const [
    totalUsers,
    totalDrivers,
    totalRides,
    pendingVerifications,
    totalBookings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "driver" } }),
    prisma.ride.count(),
    prisma.driverVerification.count({ where: { adminDecision: "pending" } }),
    prisma.booking.count(),
  ]);

  return {
    totalUsers,
    totalDrivers,
    totalRides,
    pendingVerifications,
    totalBookings,
  };
};

/** Get all drivers waiting for admin review */
const getPendingDrivers = async () => {
  const drivers = await prisma.user.findMany({
    where: {
      role: "driver",
      driverVerification: {
        is: {
          adminDecision: "pending",
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      driverStatus: true,
      createdAt: true,
      driverRejectionReason: true,
      driverVerification: {
        select: {
          id: true,
          userId: true,
          autoDecision: true,
          autoReason: true,
          autoResult: true,
          adminDecision: true,
          adminReason: true,
          reviewedByAdminId: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          documents: {
            select: {
              id: true,
              category: true,
              side: true,
              type: true,
              url: true,
              createdAt: true,
              ocrResult: true,
              ocrStatus: true,
              ocrReason: true,
            },
            orderBy: [
              { category: "asc" },
              { side: "asc" },
            ],
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    drivers: drivers.map((driver) => ({
      ...driver,
      driverVerification: formatVerification(driver.driverVerification),
    })),
  };
};

/** Get all drivers (any status) */
const getAllDrivers = async () => {
  const drivers = await prisma.user.findMany({
    where: { role: "driver" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      driverStatus: true,
      driverRejectionReason: true,
      createdAt: true,
      _count: { select: { rides: true, driverDocuments: true } },
      driverVerification: {
        select: {
          autoDecision: true,
          autoReason: true,
          adminDecision: true,
          adminReason: true,
          reviewedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    drivers: drivers.map((driver) => ({
      ...driver,
      driverVerification: formatVerification(driver.driverVerification),
    })),
  };
};

/** Get a single driver with their documents */
const getDriverWithDocuments = async (driverId) => {
  return getDriverVerificationDetail(driverId);
};

/** Approve a driver */
const approveDriver = async (adminId, driverId) => {
  return reviewDriverVerification(adminId, driverId, "approve");
};

/** Suspend a driver */
const suspendDriver = async (adminId, driverId, reason) => {
  return reviewDriverVerification(adminId, driverId, "suspend", reason);
};

/** Reject a driver with an optional reason and remove files */
const rejectDriver = async (driverId, reason) => {
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      name: true,
      driverDocuments: {
        select: {
          id: true,
          path: true,
        },
      },
    },
  });

  if (!driver) {
    const err = new Error("Driver not found");
    err.statusCode = 404;
    throw err;
  }

  const pathsToDelete = driver.driverDocuments
    .map((doc) => doc.path)
    .filter(Boolean);

  if (pathsToDelete.length > 0) {
    const { error: storageError } = await supabaseAdmin.storage
      .from("documents")
      .remove(pathsToDelete);

    if (storageError) {
      const err = new Error(
        `Failed to delete old documents: ${storageError.message}`,
      );
      err.statusCode = 500;
      throw err;
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.driverDocument.deleteMany({
      where: { userId: driverId },
    });

    await tx.driverVerification.deleteMany({
      where: { userId: driverId },
    });

    return tx.user.update({
      where: { id: driverId },
      data: {
        driverStatus: "rejected",
        driverRejectionReason:
          reason ||
          "Your documents were rejected. Please review and upload again.",
      },
      select: {
        id: true,
        name: true,
        driverStatus: true,
        driverRejectionReason: true,
      },
    });
  });

  return {
    message: `Driver ${user.name} rejected`,
    driver: user,
    reason: user.driverRejectionReason,
  };
};

/** Get all rides with optional status filter */
const getAllRides = async (status) => {
  const where = status ? { status } : {};
  const rides = await prisma.ride.findMany({
    where,
    select: {
      id: true,
      pickupAddress: true,
      dropoffAddress: true,
      departureTime: true,
      price: true,
      status: true,
      seatsTotal: true,
      femaleOnly: true,
      createdAt: true,
      currentLat: true,
      currentLng: true,
      lastUpdate: true,
      driver: { select: { id: true, name: true, email: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { rides };
};

/** Get all users */
const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      driverStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return { users };
};

const getRideDetail = async (rideId) => {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      id: true,
      pickupAddress: true,
      pickupLat: true,
      pickupLng: true,
      dropoffAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      departureTime: true,
      price: true,
      seatsTotal: true,
      status: true,
      femaleOnly: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      distanceMeters: true,
      durationSeconds: true,
      encodedPolyline: true,
      currentLat: true,
      currentLng: true,
      lastUpdate: true,
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          driverStatus: true,
            vehicle: {
              select: {
                id: true,
                carModel: true,
                carType: true,
                engineCC: true,
                avgKmPerLitre: true,
                vehicleNumber: true,
                carImageUrl: true,
              },
            },
          },
      },
      bookings: {
        select: {
          id: true,
          seatsRequested: true,
          status: true,
          createdAt: true,
          passenger: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          bookings: true,
          reviews: true,
        },
      },
    },
  });

  if (!ride) {
    const err = new Error("Ride not found");
    err.statusCode = 404;
    throw err;
  }

  return { ride };
};

module.exports = {
  getCurrentAdmin,
  getStats,
  getPendingDrivers,
  getAllDrivers,
  getDriverWithDocuments,
  approveDriver,
  suspendDriver,
  rejectDriver,
  getAllRides,
  getAllUsers,
  getRideDetail,
};
