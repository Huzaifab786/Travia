const authService = require("../services/authService");

const register = async (req, res) => {
  const { name, email, password, role, gender } = req.body;

  if (!name || !email || !password || !role || !gender) {
    return res
      .status(400)
      .json({ message: "name, email, password, role, gender are required" });
  }

  if (!["passenger", "driver", "admin"].includes(role)) {
    return res.status(400).json({ message: "role must be passenger, driver, or admin" });
  }

  if (!["male", "female", "other"].includes(gender)) {
    return res.status(400).json({ message: "gender must be male, female, or other" });
  }

  const result = await authService.register({ name, email, password, role, gender });
  return res.status(201).json(result);
};

const login = async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res
      .status(400)
      .json({ message: "email, password, role are required" });
  }

  if (!["passenger", "driver", "admin"].includes(role)) {
    return res.status(400).json({ message: "role must be passenger, driver, or admin" });
  }

  const result = await authService.login({ email, password, role });
  return res.status(200).json(result);
};

const sync = async (req, res) => {
  const { supabaseId, email, name, phone, role, gender } = req.body;

  if (!supabaseId || !email) {
    return res.status(400).json({ message: "supabaseId and email are required" });
  }

  const result = await authService.syncUser({
    supabaseId,
    email,
    name,
    phone,
    role,
    gender,
  });
  return res.status(200).json(result);
};

const me = async (req, res, next) => {
  try {
    const result = await authService.getCurrentUser(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, login, sync, me };
