-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "User" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);

-- Contas existentes: acesso liberado (sem trial de 10 min)
UPDATE "User" SET
  "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt"),
  "subscriptionStatus" = 'active',
  "subscriptionEndsAt" = "createdAt" + INTERVAL '365 days'
WHERE "emailVerifiedAt" IS NULL;

-- CreateTable
CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");
