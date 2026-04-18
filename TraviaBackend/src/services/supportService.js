const prisma = require("../config/db");

const appealSelect = {
  id: true,
  userId: true,
  email: true,
  name: true,
  role: true,
  message: true,
  status: true,
  adminNotes: true,
  reviewedByAdminId: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      accountStatus: true,
      accountSuspensionReason: true,
      accountSuspendedAt: true,
    },
  },
  reviewedByAdmin: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

async function createAccountAppeal(payload) {
  const { email, name = null, role = null, message } = payload || {};

  if (!email || typeof email !== "string") {
    const error = new Error("email is required");
    error.statusCode = 400;
    throw error;
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    const error = new Error("message is required");
    error.statusCode = 400;
    throw error;
  }

  if (role && !["passenger", "driver"].includes(role)) {
    const error = new Error("role must be passenger or driver");
    error.statusCode = 400;
    throw error;
  }

  const existingOpenAppeal = await prisma.accountAppeal.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      status: "pending",
    },
    select: { id: true },
  });

  if (existingOpenAppeal) {
    const error = new Error(
      "You already have a pending account review request.",
    );
    error.statusCode = 409;
    throw error;
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, name: true, role: true },
  });

  const appeal = await prisma.accountAppeal.create({
    data: {
      userId: existingUser?.id || null,
      email: email.trim().toLowerCase(),
      name: name?.trim() || existingUser?.name || null,
      role: role || existingUser?.role || null,
      message: message.trim(),
    },
    select: appealSelect,
  });

  return { appeal };
}

async function getAccountAppeals({ status = "all" } = {}) {
  const where = {};
  if (status && status !== "all") {
    where.status = status;
  }

  const appeals = await prisma.accountAppeal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: appealSelect,
  });

  return { appeals };
}

async function resolveAccountAppeal(adminId, appealId, payload) {
  const { status, adminNotes } = payload || {};

  const existing = await prisma.accountAppeal.findUnique({
    where: { id: appealId },
    select: {
      id: true,
      userId: true,
      email: true,
      status: true,
    },
  });

  if (!existing) {
    const error = new Error("Account appeal not found");
    error.statusCode = 404;
    throw error;
  }

  if (!["approved", "rejected"].includes(status)) {
    const error = new Error("status must be approved or rejected");
    error.statusCode = 400;
    throw error;
  }

  const updateData = {
    status,
    adminNotes: adminNotes?.trim() || undefined,
    reviewedByAdminId: adminId,
    reviewedAt: new Date(),
  };

  if (status === "approved") {
    const user = existing.userId
      ? await prisma.user.findUnique({
          where: { id: existing.userId },
          select: { id: true },
        })
      : await prisma.user.findFirst({
          where: { email: existing.email },
          select: { id: true },
        });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accountStatus: "active",
          accountSuspensionReason: null,
          accountSuspendedAt: null,
          accountSuspendedByAdminId: null,
        },
      });
    }
  }

  const appeal = await prisma.accountAppeal.update({
    where: { id: appealId },
    data: updateData,
    select: appealSelect,
  });

  return { appeal };
}

module.exports = {
  createAccountAppeal,
  getAccountAppeals,
  resolveAccountAppeal,
};
