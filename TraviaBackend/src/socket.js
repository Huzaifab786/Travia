const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("./config/db");
const {
  createRideChatMessage,
} = require("./services/chatService");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      prisma.user
        .findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            role: true,
            accountStatus: true,
          },
        })
        .then((user) => {
          if (!user || user.accountStatus === "suspended") {
            return next(new Error("Authentication error"));
          }

          socket.user = user;
          next();
        })
        .catch(() => next(new Error("Authentication error")));
    } catch (err) {
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    const userId = socket.user?.userId || socket.user?.id;
    const role = socket.user?.role;

    if (userId) {
      socket.join(`user_${userId}`);
    }

    if (role === "admin") {
      socket.join("admin_room");
    }

    socket.on("join_ride", (rideId) => {
      socket.join(`ride_${rideId}`);
    });

    socket.on("leave_ride", (rideId) => {
      socket.leave(`ride_${rideId}`);
    });

    socket.on("send_message", async (payload, ack) => {
      try {
        const { rideId, content, clientMessageId } = payload || {};

        if (!rideId) {
          throw new Error("rideId is required");
        }

        const latestUser = await prisma.user.findUnique({
          where: { id: socket.user.id },
          select: {
            id: true,
            accountStatus: true,
          },
        });

        if (!latestUser || latestUser.accountStatus === "suspended") {
          throw new Error("Your account has been suspended");
        }

        if (socket.user?.accountStatus === "suspended") {
          throw new Error("Your account has been suspended");
        }

        const message = await createRideChatMessage({
          rideId,
          content,
          senderId: socket.user.id,
          clientMessageId,
        });

        io.to(`ride_${rideId}`).emit("new_message", message);

        if (typeof ack === "function") {
          ack({ ok: true, data: message });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({
            ok: false,
            error: error.statusCode ? error.message : "Failed to send message",
          });
        }
      }
    });

    socket.on("disconnect", () => {
    });
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

module.exports = {
  initSocket,
  getIo,
};
