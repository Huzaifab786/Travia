const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { requireRole } = require("../middlewares/requireRole");
const driverController = require("../controllers/driverController");

// All driver routes are protected and require driver role
router.get("/status", protect, requireRole("driver"), driverController.getStatus);
router.post("/upload-documents", protect, requireRole("driver"), driverController.uploadDocuments);

module.exports = router;
