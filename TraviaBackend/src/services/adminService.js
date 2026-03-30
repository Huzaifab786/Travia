const prisma = require("../config/db");

/** Get dashboard stats */
const getStats = async () => {
  const [totalUsers, totalDrivers, totalRides, pendingVerifications, totalBookings] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "driver" } }),
      prisma.ride.count(),
      prisma.user.count({ where: { role: "driver", driverStatus: "pending" } }),
      prisma.booking.count(),
    ]);

  return { totalUsers, totalDrivers, totalRides, pendingVerifications, totalBookings };
};

/** Get all drivers with pending verification */
const getPendingDrivers = async () => {
  const drivers = await prisma.user.findMany({
    where: { role: "driver", driverStatus: "pending" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      driverStatus: true,
      createdAt: true,
      driverDocuments: {
        select: { id: true, type: true, url: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return { drivers };
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
      createdAt: true,
      _count: { select: { rides: true, driverDocuments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return { drivers };
};

/** Get a single driver with their documents */
const getDriverWithDocuments = async (driverId) => {
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      driverStatus: true,
      createdAt: true,
      driverDocuments: {
        select: { id: true, type: true, url: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      vehicle: {
        select: { carModel: true, carType: true, engineCC: true },
      },
      _count: { select: { rides: true } },
    },
  });

  if (!driver || driver.role !== "driver") {
    const err = new Error("Driver not found");
    err.statusCode = 404;
    throw err;
  }

  return { driver };
};

/** Approve a driver */
const approveDriver = async (driverId) => {
  const user = await prisma.user.update({
    where: { id: driverId },
    data: { driverStatus: "verified" },
    select: { id: true, name: true, driverStatus: true },
  });
  return { message: `Driver ${user.name} approved successfully`, driver: user };
};

/** Reject a driver with an optional reason */
const rejectDriver = async (driverId, reason) => {
  const user = await prisma.user.update({
    where: { id: driverId },
    data: { driverStatus: "rejected" },
    select: { id: true, name: true, driverStatus: true },
  });
  return { message: `Driver ${user.name} rejected`, driver: user, reason: reason || null };
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
      createdAt: true,
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

module.exports = {
  getStats,
  getPendingDrivers,
  getAllDrivers,
  getDriverWithDocuments,
  approveDriver,
  rejectDriver,
  getAllRides,
  getAllUsers,
};
