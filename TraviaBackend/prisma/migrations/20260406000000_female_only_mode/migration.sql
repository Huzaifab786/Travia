DO $$
BEGIN
  CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "gender" "Gender";

ALTER TABLE "Ride"
  ADD COLUMN IF NOT EXISTS "femaleOnly" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_gender_idx"
ON "User"("gender");

CREATE INDEX IF NOT EXISTS "Ride_femaleOnly_idx"
ON "Ride"("femaleOnly");
