const incidentService = require("../services/incidentService");

const createIncident = async (req, res, next) => {
  try {
    const data = await incidentService.createRideIncident({
      userId: req.user.id,
      role: req.user.role,
      payload: req.body,
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createIncident,
};
