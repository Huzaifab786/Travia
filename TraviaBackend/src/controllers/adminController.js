const adminService = require("../services/adminService");
const pricingService = require("../services/pricingService");

const getMe = async (req, res, next) => {
  try {
    const data = await adminService.getCurrentAdmin(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const data = await adminService.getStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getPendingDrivers = async (req, res, next) => {
  try {
    const data = await adminService.getPendingDrivers();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getAllDrivers = async (req, res, next) => {
  try {
    const data = await adminService.getAllDrivers();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getDriverDetail = async (req, res, next) => {
  try {
    const data = await adminService.getDriverWithDocuments(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const approveDriver = async (req, res, next) => {
  try {
    const data = await adminService.approveDriver(req.user.id, req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const suspendDriver = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const data = await adminService.suspendDriver(
      req.user.id,
      req.params.id,
      reason,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const rejectDriver = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const data = await adminService.rejectDriver(req.params.id, reason);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getAllRides = async (req, res, next) => {
  try {
    const data = await adminService.getAllRides(req.query.status);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const data = await adminService.getAllUsers();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getRideDetail = async (req, res, next) => {
  try {
    const data = await adminService.getRideDetail(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getPricingSettings = async (req, res, next) => {
  try {
    const pricingSettings = await pricingService.getPricingSettings();
    res.json({ pricingSettings });
  } catch (err) {
    next(err);
  }
};

const updatePricingSettings = async (req, res, next) => {
  try {
    const pricingSettings = await pricingService.updatePricingSettings(
      req.body,
    );
    res.json({ pricingSettings });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMe,
  getStats,
  getPendingDrivers,
  getAllDrivers,
  getDriverDetail,
  approveDriver,
  suspendDriver,
  rejectDriver,
  getAllRides,
  getAllUsers,
  getRideDetail,
  getPricingSettings,
  updatePricingSettings,
};
