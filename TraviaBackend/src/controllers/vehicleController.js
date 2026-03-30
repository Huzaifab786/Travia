const vehicleService = require("../services/vehicleService");

/**
 * GET /api/vehicle
 */
const getMyVehicle = async (req, res) => {
  const vehicle = await vehicleService.getVehicleByUserId(req.user.id);
  return res.status(200).json({ vehicle });
};

/**
 * POST /api/vehicle
 * Update or Create vehicle
 */
const updateMyVehicle = async (req, res) => {
  const vehicle = await vehicleService.upsertVehicle(req.user.id, req.body);
  return res.status(200).json({ vehicle });
};

module.exports = {
  getMyVehicle,
  updateMyVehicle,
};
