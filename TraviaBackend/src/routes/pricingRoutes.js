const router = require("express").Router();
const ctrl = require("../controllers/pricingController");

router.get("/", ctrl.getPricingSettings);

module.exports = router;
