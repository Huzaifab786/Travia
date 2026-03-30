const express = require("express");
const router = express.Router();
const asyncHandler = require("../middlewares/asyncHandler");
const {
  searchPlacesController,
  reverseGeocodeController,
} = require("../controllers/placeController");

router.get("/search", asyncHandler(searchPlacesController));
router.get("/reverse", asyncHandler(reverseGeocodeController));

module.exports = router;