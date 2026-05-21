-- CreateTable
CREATE TABLE "IssuedSubscriptionCode" (
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,

    CONSTRAINT "IssuedSubscriptionCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "VoucherCodeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "VoucherCodeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoucherCodeRequest_status_createdAt_idx" ON "VoucherCodeRequest"("status", "createdAt");
