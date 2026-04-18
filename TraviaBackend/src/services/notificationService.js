const { getIo } = require("../socket");

function buildNotification({
  userId,
  title,
  body,
  type,
  data = {},
}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    userId,
    title,
    body,
    type,
    data,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

function emitUserNotification(payload) {
  const notification = buildNotification(payload);
  getIo().to(`user_${payload.userId}`).emit("notification", notification);
  return notification;
}

function emitMultipleUserNotifications(users, payloadFactory) {
  return users
    .filter(Boolean)
    .map((userId) => emitUserNotification(payloadFactory(userId)));
}

module.exports = {
  buildNotification,
  emitUserNotification,
  emitMultipleUserNotifications,
};
