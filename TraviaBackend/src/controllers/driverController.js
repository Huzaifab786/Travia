const driverService = require("../services/driverService");

const getStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await driverService.getDriverStatus(userId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

const uploadDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documents } = req.body;
    const result = await driverService.uploadDocuments(userId, documents);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = {
  getStatus,
  uploadDocuments,
};
