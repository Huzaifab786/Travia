const express = require("express");
const router = express.Router();

const { protect, optionalProtect } = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/requireRole");
const {
  createRide,
  listRides,
  getRideById,
  listMyRides,
  cancelRide,
  updateRideLocation,
  getRideLocation,
  startRideController,
  completeRideController,
  deleteRideController,
} = require("../controllers/rideController");

// Public route (passenger will use this)
router.get("/", optionalProtect, listRides);

// Driver-only routes
router.post("/", protect, requireRole("driver"), createRide);
router.get("/me", protect, requireRole("driver"), listMyRides);

// Passenger / authenticated detail route
router.get("/:id", optionalProtect, getRideById);

router.patch("/:id/cancel", protect, requireRole("driver"), cancelRide);
router.patch("/:id/start", protect, requireRole("driver"), startRideController);
router.patch("/:id/complete", protect, requireRole("driver"), completeRideController);
router.delete("/:id", protect, requireRole("driver"), deleteRideController);

// Real-time tracking
router.patch("/:id/location", protect, requireRole("driver"), updateRideLocation);
router.get("/:id/location", protect, getRideLocation); // both driver and passenger can poll

module.exports = router;
