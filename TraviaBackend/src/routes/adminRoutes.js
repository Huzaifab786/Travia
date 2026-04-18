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
router.post("/drivers/:id/suspend", ctrl.suspendDriver);
router.post("/drivers/:id/reject", ctrl.rejectDriver);

// Ride management
router.get("/rides", ctrl.getAllRides);
router.get("/incidents", ctrl.getIncidents);
router.patch("/incidents/:id", ctrl.updateIncident);

// Pricing management
router.get("/pricing", ctrl.getPricingSettings);
router.put("/pricing", ctrl.updatePricingSettings);

// User management
router.get("/users", ctrl.getAllUsers);
router.post("/users/:id/suspend", ctrl.suspendUser);
router.post("/users/:id/restore", ctrl.restoreUser);
router.get("/appeals", ctrl.getAppeals);
router.patch("/appeals/:id", ctrl.updateAppeal);
//Ride details management
router.get("/rides/:id", ctrl.getRideDetail);


module.exports = router;
