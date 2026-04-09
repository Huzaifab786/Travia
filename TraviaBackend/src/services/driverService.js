const {
  getDriverVerificationStatus,
  submitDriverVerification,
} = require("./driverVerificationService");

const getDriverStatus = async (userId) => {
  return getDriverVerificationStatus(userId);
};

const uploadDocuments = async (userId, documents) => {
  if (!Array.isArray(documents) || documents.length === 0) {
    const err = new Error("Documents are required");
    err.statusCode = 400;
    throw err;
  }

  return submitDriverVerification(userId, documents);
};

module.exports = {
  getDriverStatus,
  uploadDocuments,
};
