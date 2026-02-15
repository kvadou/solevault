-- AlterTable
ALTER TABLE "VaultItem" ADD COLUMN     "fmvOverrideCents" INTEGER;

-- CreateTable
CREATE TABLE "BuybackTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "fmvCents" INTEGER NOT NULL,
    "payoutCents" INTEGER NOT NULL,
    "platformRevenueCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuybackTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuybackTransaction_userId_createdAt_idx" ON "BuybackTransaction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BuybackTransaction" ADD CONSTRAINT "BuybackTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuybackTransaction" ADD CONSTRAINT "BuybackTransaction_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
