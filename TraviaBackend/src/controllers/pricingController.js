const pricingService = require("../services/pricingService");

const getPricingSettings = async (req, res, next) => {
  try {
    const pricingSettings = await pricingService.getPricingSettings();
    res.json({ pricingSettings });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPricingSettings,
};
