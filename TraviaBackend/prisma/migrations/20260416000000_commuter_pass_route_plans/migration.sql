ALTER TABLE "CommuterPass"
  ADD COLUMN IF NOT EXISTS "planType" TEXT,
  ADD COLUMN IF NOT EXISTS "durationDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "routeSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "routePickup" JSONB,
  ADD COLUMN IF NOT EXISTS "routeDropoff" JSONB;

CREATE INDEX IF NOT EXISTS "CommuterPass_passengerId_driverId_routeSignature_status_idx"
  ON "CommuterPass"("passengerId", "driverId", "routeSignature", "status");
