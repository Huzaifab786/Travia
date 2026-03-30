const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");

router.get("/me", protect, (req, res) => {
  res.status(200).json({
    message: "Protected route working",
    user: req.user,
  });
});

module.exports = router;