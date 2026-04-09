ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "vehicleNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "carImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "carImagePath" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_vehicleNumber_key"
ON "Vehicle"("vehicleNumber");
