const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/requireRole");
const {
  createBooking,
  quoteBooking,
  listMyBookings,
  listDriverRequests,
  updateBookingStatus,
  getMyBookingForRide,
  cancelMyBooking,
  deleteBookingController,
} = require("../controllers/bookingController");

router.post("/quote", protect, requireRole("passenger"), quoteBooking);
router.post("/", protect, requireRole("passenger"), createBooking);
router.get("/me", protect, requireRole("passenger"), listMyBookings);
router.get("/driver/requests", protect, requireRole("driver"), listDriverRequests);
router.patch("/:id", protect, requireRole("driver"), updateBookingStatus);

router.get("/ride/:rideId", protect, requireRole("passenger"), getMyBookingForRide);
router.patch("/:id/cancel", protect, requireRole("passenger"), cancelMyBooking);
router.delete("/:id", protect, requireRole("passenger"), deleteBookingController);

module.exports = router;
