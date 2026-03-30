const prisma = require("../config/db");

/**
 * Get vehicle details for a user
 */
const getVehicleByUserId = async (userId) => {
  return await prisma.vehicle.findUnique({
    where: { userId },
  });
};

/**
 * Create or update vehicle details
 */
const upsertVehicle = async (userId, data) => {
  const { carModel, carType, engineCC, avgKmPerLitre, fuelPricePerLitre } = data;

  return await prisma.vehicle.upsert({
    where: { userId },
    update: {
      carModel,
      carType,
      engineCC: engineCC ? Number(engineCC) : null,
      avgKmPerLitre: Number(avgKmPerLitre),
      fuelPricePerLitre: Number(fuelPricePerLitre),
    },
    create: {
      userId,
      carModel,
      carType,
      engineCC: engineCC ? Number(engineCC) : null,
      avgKmPerLitre: Number(avgKmPerLitre),
      fuelPricePerLitre: Number(fuelPricePerLitre),
    },
  });
};

module.exports = {
  getVehicleByUserId,
  upsertVehicle,
};
