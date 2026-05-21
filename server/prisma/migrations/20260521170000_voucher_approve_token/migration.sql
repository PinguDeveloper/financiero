-- AlterTable
ALTER TABLE "VoucherCodeRequest" ADD COLUMN "approveToken" TEXT;
ALTER TABLE "VoucherCodeRequest" ADD COLUMN "expectedAmountCents" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "VoucherCodeRequest_approveToken_key" ON "VoucherCodeRequest"("approveToken");
