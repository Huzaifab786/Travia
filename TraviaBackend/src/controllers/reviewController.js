const reviewService = require("../services/reviewService");

const createPassengerReview = async (req, res) => {
  const { rideId, rating, comment } = req.body;

  if (!rideId) {
    return res.status(400).json({ message: "rideId is required" });
  }

  const numericRating = Number(rating);

  if (!numericRating || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ message: "rating must be between 1 and 5" });
  }

  const result = await reviewService.createPassengerReview(
    req.user.id,
    rideId,
    numericRating,
    comment,
  );

  return res.status(201).json(result);
};

const getMyReviewForRide = async (req, res) => {
  const { rideId } = req.params;
  const result = await reviewService.getMyReviewForRide(req.user.id, rideId);
  return res.status(200).json(result);
};

module.exports = {
  createPassengerReview,
  getMyReviewForRide,
};