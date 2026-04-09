-- CreatePricingSetting table for admin-managed fuel pricing
CREATE TABLE IF NOT EXISTS "PricingSetting" (
  "id" TEXT NOT NULL,
  "fuelPricePerLitre" DOUBLE PRECISION NOT NULL DEFAULT 270.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("id")
);
