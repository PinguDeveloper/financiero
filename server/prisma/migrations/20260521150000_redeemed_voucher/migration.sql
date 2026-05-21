CREATE TABLE "RedeemedVoucher" (
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RedeemedVoucher_pkey" PRIMARY KEY ("code")
);
