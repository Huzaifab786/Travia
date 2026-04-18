const prisma = require("../config/db");

async function getRideChatMessages(rideId) {
  return prisma.message.findMany({
    where: { rideId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: {
        select: { id: true, name: true, role: true, avatarUrl: true },
      },
    },
  });
}

async function createRideChatMessage({ rideId, content, senderId, clientMessageId }) {
  if (!content || !String(content).trim()) {
    const error = new Error("Content is required");
    error.statusCode = 400;
    throw error;
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: { bookings: true },
  });

  if (!ride) {
    const error = new Error("Ride not found");
    error.statusCode = 404;
    throw error;
  }

  const isDriver = ride.driverId === senderId;
  const isPassenger = ride.bookings.some(
    (booking) =>
      booking.passengerId === senderId &&
      ["accepted", "picked_up", "dropped_off"].includes(booking.status),
  );

  if (!isDriver && !isPassenger) {
    const error = new Error("Not participant in this ride");
    error.statusCode = 403;
    throw error;
  }

  const message = await prisma.message.create({
    data: {
      content: String(content).trim(),
      rideId,
      senderId,
    },
    include: {
      sender: {
        select: { id: true, name: true, role: true, avatarUrl: true },
      },
    },
  });

  return clientMessageId
    ? { ...message, clientMessageId }
    : message;
}

module.exports = {
  getRideChatMessages,
  createRideChatMessage,
};
