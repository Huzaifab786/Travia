const express = require("express");
const router = express.Router();
const { getRideRoute, previewRoute } = require("../controllers/routeController");
const asyncHandler = require("../middlewares/asyncHandler");

router.get("/ride/:rideId", asyncHandler(getRideRoute));
router.get("/preview", asyncHandler(previewRoute));

module.exports = router;