const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const asyncHandler = require("../middlewares/asyncHandler");

router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.post("/sync", asyncHandler(authController.sync));

module.exports = router;