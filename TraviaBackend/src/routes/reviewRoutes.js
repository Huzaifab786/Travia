const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/requireRole");
const {
  createPassengerReview,
  getMyReviewForRide,
} = require("../controllers/reviewController");

router.post("/", protect, requireRole("passenger"), createPassengerReview);
router.get("/ride/:rideId", protect, requireRole("passenger"), getMyReviewForRide);

module.exports = router;