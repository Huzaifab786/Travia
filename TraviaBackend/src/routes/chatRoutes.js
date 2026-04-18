const express = require("express");
const { getMessages, sendMessage } = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/:rideId/messages", protect, getMessages);
router.post("/:rideId/messages", protect, sendMessage);

module.exports = router;
