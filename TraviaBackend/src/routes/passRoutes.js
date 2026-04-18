const express = require("express");
const { 
  getEligibleDrivers, 
  requestPass, 
  getDriverPasses, 
  approvePass,
  getPassengerActivePasses
} = require("../controllers/passController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// Passenger routes
router.get("/eligible", protect, getEligibleDrivers);
router.get("/passenger", protect, getPassengerActivePasses);
router.post("/request", protect, requestPass);

// Driver routes
router.get("/driver", protect, getDriverPasses);
router.post("/driver/:id/approve", protect, approvePass);

module.exports = router;
