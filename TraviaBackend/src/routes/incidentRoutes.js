const router = require("express").Router();
const { protect } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/incidentController");

router.use(protect);

router.post("/", ctrl.createIncident);

module.exports = router;
