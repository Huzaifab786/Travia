const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { getMyVehicle, updateMyVehicle } = require("../controllers/vehicleController");

router.get("/", protect, getMyVehicle);
router.post("/", protect, updateMyVehicle);

module.exports = router;
