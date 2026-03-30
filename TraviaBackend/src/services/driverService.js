const prisma = require("../config/db");

const getDriverStatus = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      driverStatus: true,
      driverRejectionReason: true,
    },
  });

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  return {
    status: user.driverStatus,
    rejectionReason: user.driverRejectionReason,
  };
};

const uploadDocuments = async (userId, documents) => {
  if (!Array.isArray(documents) || documents.length === 0) {
    const err = new Error("Documents are required");
    err.statusCode = 400;
    throw err;
  }

  await prisma.$transaction([
    prisma.driverDocument.deleteMany({
      where: { userId },
    }),
    prisma.driverDocument.createMany({
      data: documents.map((doc) => ({
        userId,
        type: doc.type,
        url: doc.url,
        path: doc.path || null,
      })),
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        driverStatus: "pending",
        driverRejectionReason: null,
      },
    }),
  ]);

  return { message: "Documents uploaded successfully. Status set to pending." };
};

module.exports = {
  getDriverStatus,
  uploadDocuments,
};
