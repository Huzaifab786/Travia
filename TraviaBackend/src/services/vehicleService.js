const prisma = require("../config/db");
const supabaseAdmin = require("../config/supabaseAdmin");

/**
 * Get vehicle details for a user
 */
const getVehicleByUserId = async (userId) => {
  return await prisma.vehicle.findUnique({
    where: { userId },
  });
};

async function removePreviousCarImage(vehicle) {
  if (!vehicle?.carImagePath) {
    return;
  }

  const { error } = await supabaseAdmin.storage
    .from("documents")
    .remove([vehicle.carImagePath]);

  if (error) {
    console.warn("Failed to remove previous car image:", error.message);
  }
}

/**
 * Create or update vehicle details
 */
const upsertVehicle = async (userId, data) => {
  const {
    carModel,
    carType,
    vehicleNumber,
    engineCC,
    avgKmPerLitre,
    carImageUrl,
    carImagePath,
  } = data;

  const fuelAverage = Number(avgKmPerLitre);

  if (!carModel || !vehicleNumber || !Number.isFinite(fuelAverage) || fuelAverage <= 0) {
    const err = new Error(
      "Car model, vehicle number, and fuel average are required",
    );
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.vehicle.findUnique({
    where: { userId },
  });

  if (carImagePath && existing?.carImagePath && existing.carImagePath !== carImagePath) {
    await removePreviousCarImage(existing);
  }

  return await prisma.vehicle.upsert({
    where: { userId },
    update: {
      carModel,
      carType,
      vehicleNumber: vehicleNumber.trim(),
      engineCC: engineCC ? Number(engineCC) : null,
      avgKmPerLitre: fuelAverage,
      carImageUrl: carImageUrl || existing?.carImageUrl || null,
      carImagePath: carImagePath || existing?.carImagePath || null,
    },
    create: {
      userId,
      carModel,
      carType,
      vehicleNumber: vehicleNumber.trim(),
      engineCC: engineCC ? Number(engineCC) : null,
      avgKmPerLitre: fuelAverage,
      carImageUrl: carImageUrl || null,
      carImagePath: carImagePath || null,
    },
  });
};

module.exports = {
  getVehicleByUserId,
  upsertVehicle,
};
