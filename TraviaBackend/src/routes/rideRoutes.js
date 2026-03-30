const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/requireRole");
const {
  createRide,
  listRides,
  listMyRides,
  cancelRide,
  updateRideLocation,
  getRideLocation,
  completeRideController,
  deleteRideController,
} = require("../controllers/rideController");

// Public route (passenger will use this)
router.get("/", listRides);

// Driver-only routes
router.post("/", protect, requireRole("driver"), createRide);
router.get("/me", protect, requireRole("driver"), listMyRides);
router.patch("/:id/cancel", protect, requireRole("driver"), cancelRide);
router.patch("/:id/complete", protect, requireRole("driver"), completeRideController);
router.delete("/:id", protect, requireRole("driver"), deleteRideController);

// Real-time tracking
router.patch("/:id/location", protect, requireRole("driver"), updateRideLocation);
router.get("/:id/location", protect, getRideLocation); // both driver and passenger can poll

module.exports = router;