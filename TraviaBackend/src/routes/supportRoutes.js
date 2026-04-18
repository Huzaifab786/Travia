const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { protect, requireAdmin } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/supportController");

router.post("/account-appeals", asyncHandler(ctrl.createAccountAppeal));
router.get("/account-appeals", protect, requireAdmin, asyncHandler(ctrl.getAccountAppeals));
router.patch("/account-appeals/:id", protect, requireAdmin, asyncHandler(ctrl.resolveAccountAppeal));

module.exports = router;
