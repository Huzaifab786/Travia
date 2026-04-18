const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const { setCachedUserSnapshot } = require("../cache/userSnapshotCache");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        gender: true,
        accountStatus: true,
        accountSuspensionReason: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    if (user.accountStatus === "suspended") {
      return res.status(403).json({
        message:
          "Your account has been suspended" +
          (user.accountSuspensionReason
            ? `: ${user.accountSuspensionReason}`
            : ". Please contact support."),
      });
    }

    req.user = setCachedUserSnapshot(user);

    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

const optionalProtect = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        gender: true,
        accountStatus: true,
        accountSuspensionReason: true,
      },
    });

    if (user) {
      if (user.accountStatus === "suspended") {
        return next();
      }

      req.user = setCachedUserSnapshot(user);
    }

    return next();
  } catch (err) {
    return next();
  }
};

/** Gates a route to admin-role users only (must run after protect) */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied: Admins only" });
  }
  next();
};

module.exports = { protect, optionalProtect, requireAdmin };
