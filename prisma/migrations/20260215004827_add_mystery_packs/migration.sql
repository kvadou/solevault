-- CreateTable
CREATE TABLE "PackTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "totalSupply" INTEGER NOT NULL,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dropId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackPoolItem" (
    "id" TEXT NOT NULL,
    "packTierId" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "oddsWeight" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'available',
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "PackPoolItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackRip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packTierId" TEXT NOT NULL,
    "packPoolItemId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "platformRevenueCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "revealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackRip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackTier_slug_key" ON "PackTier"("slug");

-- CreateIndex
CREATE INDEX "PackPoolItem_packTierId_status_idx" ON "PackPoolItem"("packTierId", "status");

-- CreateIndex
CREATE INDEX "PackRip_userId_createdAt_idx" ON "PackRip"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PackPoolItem" ADD CONSTRAINT "PackPoolItem_packTierId_fkey" FOREIGN KEY ("packTierId") REFERENCES "PackTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackPoolItem" ADD CONSTRAINT "PackPoolItem_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackRip" ADD CONSTRAINT "PackRip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackRip" ADD CONSTRAINT "PackRip_packTierId_fkey" FOREIGN KEY ("packTierId") REFERENCES "PackTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackRip" ADD CONSTRAINT "PackRip_packPoolItemId_fkey" FOREIGN KEY ("packPoolItemId") REFERENCES "PackPoolItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
