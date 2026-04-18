const supportService = require("../services/supportService");

const createAccountAppeal = async (req, res, next) => {
  try {
    const result = await supportService.createAccountAppeal(req.body);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
};

const getAccountAppeals = async (req, res, next) => {
  try {
    const result = await supportService.getAccountAppeals({
      status: req.query.status,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

const resolveAccountAppeal = async (req, res, next) => {
  try {
    const result = await supportService.resolveAccountAppeal(
      req.user.id,
      req.params.id,
      req.body,
    );
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createAccountAppeal,
  getAccountAppeals,
  resolveAccountAppeal,
};
