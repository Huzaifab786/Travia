const router = require("express").Router();
const { protect, requireAdmin } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/adminController");

// All routes require a valid JWT + admin role
router.use(protect, requireAdmin);

router.get("/me", ctrl.getMe);

// Dashboard
router.get("/stats", ctrl.getStats);

// Driver management
router.get("/drivers", ctrl.getAllDrivers);
router.get("/drivers/pending", ctrl.getPendingDrivers);
router.get("/drivers/:id", ctrl.getDriverDetail);
router.post("/drivers/:id/approve", ctrl.approveDriver);
router.post("/drivers/:id/reject", ctrl.rejectDriver);

// Ride management
router.get("/rides", ctrl.getAllRides);

// User management
router.get("/users", ctrl.getAllUsers);
//Ride details management
router.get("/rides/:id", ctrl.getRideDetail);

module.exports = router;
