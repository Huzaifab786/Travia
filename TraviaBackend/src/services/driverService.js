const prisma = require("../config/db");

const getDriverStatus = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driverStatus: true },
  });
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  return { status: user.driverStatus };
};

const uploadDocuments = async (userId, documents) => {
  // documents: [{ type: 'cnic' | 'license' | 'registration', url: string }]
  if (!Array.isArray(documents) || documents.length === 0) {
    const err = new Error("Documents are required");
    err.statusCode = 400;
    throw err;
  }

  // Create documents and update user status to pending
  await prisma.$transaction([
    prisma.driverDocument.createMany({
      data: documents.map((doc) => ({
        userId,
        type: doc.type,
        url: doc.url,
      })),
    }),
    prisma.user.update({
      where: { id: userId },
      data: { driverStatus: "pending" },
    }),
  ]);

  return { message: "Documents uploaded successfully. Status set to pending." };
};

module.exports = {
  getDriverStatus,
  uploadDocuments,
};
