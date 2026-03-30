const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const { signToken } = require("../config/jwt");

const register = async ({ name, email, password, role }) => {
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
    },
  });

  const token = signToken({ userId: user.id, role: user.role });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
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

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    throw err;
  }

  // ✅ Role check (THIS is what you need)
  if (user.role !== role) {
    const err = new Error(`You are not registered as a ${role}. Please switch role.`);
    err.statusCode = 403;
    throw err;
  }

  const token = signToken({ userId: user.id, role: user.role });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token,
  };
};

const syncUser = async ({ supabaseId, email, name, phone, role }) => {
  // 1. Check if user exists by supabaseId
  let user = await prisma.user.findUnique({ where: { supabaseId } });

  if (user) {
    // Check role mismatch
    if (role && user.role !== role) {
      const err = new Error(`You are registered as a ${user.role}. Please log in as a ${user.role} instead.`);
      err.statusCode = 403;
      throw err;
    }

    // Update existing user if needed
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name, email, phone },
    });
  } else {
    // 2. Check if email/phone exists but doesn't have a supabaseId yet (linking step)
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone: phone || undefined }] },
    });

    if (existing) {
      // Check role mismatch on linking
      if (role && existing.role !== role) {
        const err = new Error(`You are registered as a ${existing.role}. Please log in as a ${existing.role} instead.`);
        err.statusCode = 403;
        throw err;
      }

      user = await prisma.user.update({
        where: { id: existing.id },
        data: { supabaseId, name, email, phone },
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
        },
      });
    }
  }

  const token = signToken({ userId: user.id, role: user.role });

  return {
    user: {
      id: user.id,
      supabaseId: user.supabaseId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    token,
  };
};

module.exports = { register, login, syncUser };