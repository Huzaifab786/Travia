const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const { signToken } = require("../config/jwt");
const { setCachedUserSnapshot } = require("../cache/userSnapshotCache");

const register = async ({ name, email, password, role, gender }) => {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const err = new Error("Email already in use");
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: role || "passenger",
      gender: gender || null,
    },
  });

  const token = signToken({ userId: user.id, role: user.role });
  setCachedUserSnapshot(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      gender: user.gender,
    },
    token,
  };
};

const login = async ({ email, password, role }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  if (user.accountStatus === "suspended") {
    const err = new Error(
      user.accountSuspensionReason ||
        "Your account has been suspended. Please contact support.",
    );
    err.statusCode = 403;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  // Role check (preserves your existing login flow)
  if (user.role !== role) {
    const err = new Error(
      `You are not registered as a ${role}. Please switch role.`,
    );
    err.statusCode = 403;
    throw err;
  }

  const token = signToken({ userId: user.id, role: user.role });
  setCachedUserSnapshot(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      gender: user.gender,
    },
    token,
  };
};

const syncUser = async ({ supabaseId, email, name, phone, role, gender }) => {
  // 1. Check if user exists by supabaseId
  let user = await prisma.user.findUnique({ where: { supabaseId } });

  if (user) {
    if (user.accountStatus === "suspended") {
      const err = new Error(
        user.accountSuspensionReason ||
          "Your account has been suspended. Please contact support.",
      );
      err.statusCode = 403;
      throw err;
    }

    // Check role mismatch
    if (role && user.role !== role) {
      const err = new Error(
        `You are registered as a ${user.role}. Please log in as a ${user.role} instead.`,
      );
      err.statusCode = 403;
      throw err;
    }

    // Update existing user if needed
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name, email, phone, gender: gender || undefined },
    });
  } else {
    // 2. Check if email/phone exists but doesn't have a supabaseId yet (linking step)
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone: phone || undefined }] },
    });

    if (existing) {
      if (existing.accountStatus === "suspended") {
        const err = new Error(
          existing.accountSuspensionReason ||
            "Your account has been suspended. Please contact support.",
        );
        err.statusCode = 403;
        throw err;
      }

      // Check role mismatch on linking
      if (role && existing.role !== role) {
        const err = new Error(
          `You are registered as a ${existing.role}. Please log in as a ${existing.role} instead.`,
        );
        err.statusCode = 403;
        throw err;
      }

      user = await prisma.user.update({
        where: { id: existing.id },
        data: { supabaseId, name, email, phone, gender: gender || undefined },
      });
    } else {
      // 3. Create new user
      user = await prisma.user.create({
        data: {
          supabaseId,
          name,
          email,
          phone,
          role: role || "passenger",
          gender: gender || null,
        },
      });
    }
  }

  const token = signToken({ userId: user.id, role: user.role });
  setCachedUserSnapshot(user);

  return {
    user: {
      id: user.id,
      supabaseId: user.supabaseId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      gender: user.gender,
    },
    token,
  };
};

const getCurrentUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      gender: true,
      accountStatus: true,
      accountSuspensionReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  if (user.accountStatus === "suspended") {
    const err = new Error(
      user.accountSuspensionReason ||
        "Your account has been suspended. Please contact support.",
    );
    err.statusCode = 403;
    throw err;
  }

  return { user };
};

module.exports = { register, login, syncUser, getCurrentUser };
