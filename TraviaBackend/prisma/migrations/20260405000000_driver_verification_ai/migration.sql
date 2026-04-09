-- Create enums for verification workflow
DO $$ BEGIN
    CREATE TYPE "VerificationDecision" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AdminReviewDecision" AS ENUM ('pending', 'approved', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DocumentCategory" AS ENUM ('cnic', 'license', 'registration');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "DocumentSide" AS ENUM ('front', 'back');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "DriverDocumentStatus" ADD VALUE IF NOT EXISTS 'suspended';

-- DriverVerification table
CREATE TABLE IF NOT EXISTS "DriverVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoDecision" "VerificationDecision" NOT NULL DEFAULT 'pending',
    "autoReason" TEXT,
    "autoResult" JSONB,
    "adminDecision" "AdminReviewDecision" NOT NULL DEFAULT 'pending',
    "adminReason" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DriverVerification_userId_key" ON "DriverVerification"("userId");
CREATE INDEX IF NOT EXISTS "DriverVerification_adminDecision_idx" ON "DriverVerification"("adminDecision");

ALTER TABLE "DriverVerification"
    ADD CONSTRAINT "DriverVerification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DriverVerification"
    ADD CONSTRAINT "DriverVerification_reviewedByAdminId_fkey"
    FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend DriverDocument for front/back OCR storage
ALTER TABLE "DriverDocument"
    ADD COLUMN IF NOT EXISTS "verificationId" TEXT,
    ADD COLUMN IF NOT EXISTS "category" "DocumentCategory",
    ADD COLUMN IF NOT EXISTS "side" "DocumentSide",
    ADD COLUMN IF NOT EXISTS "ocrResult" JSONB,
    ADD COLUMN IF NOT EXISTS "ocrStatus" "VerificationDecision" NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS "ocrReason" TEXT;

CREATE INDEX IF NOT EXISTS "DriverDocument_verificationId_idx" ON "DriverDocument"("verificationId");
CREATE INDEX IF NOT EXISTS "DriverDocument_userId_category_side_idx" ON "DriverDocument"("userId", "category", "side");

ALTER TABLE "DriverDocument"
    ADD CONSTRAINT "DriverDocument_verificationId_fkey"
    FOREIGN KEY ("verificationId") REFERENCES "DriverVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
