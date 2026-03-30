const authService = require("../services/authService");

const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res
      .status(400)
      .json({ message: "name, email, password, role are required" });
  }

  if (!["passenger", "driver", "admin"].includes(role)) {
    return res.status(400).json({ message: "role must be passenger, driver, or admin" });
  }

  const result = await authService.register({ name, email, password, role });
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
  const { supabaseId, email, name, phone, role } = req.body;

  if (!supabaseId || !email) {
    return res.status(400).json({ message: "supabaseId and email are required" });
  }

  const result = await authService.syncUser({
    supabaseId,
    email,
    name,
    phone,
    role,
  });
  return res.status(200).json(result);
};

module.exports = { register, login, sync };