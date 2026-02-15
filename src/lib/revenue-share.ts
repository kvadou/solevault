import { prisma } from "@/lib/prisma";

const REVENUE_SHARE_PERCENTAGE = 0.01; // 1% to original vaulter
const MIN_PAYOUT_CENTS = 50; // $0.50 minimum for batch credit

interface CreateRevenueShareParams {
  vaultItemId: string;
  sourceType: "pack_rip" | "buyback" | "marketplace_sale";
  sourceId: string;
  totalRevenueCents: number;
}

/**
 * Creates a revenue share record for the original vaulter of an item.
 * Only creates if the item has an originalVaulterId.
 * Returns the created record or null if not applicable.
 */
export async function createRevenueShare({
  vaultItemId,
  sourceType,
  sourceId,
  totalRevenueCents,
}: CreateRevenueShareParams) {
  if (totalRevenueCents <= 0) return null;

  const item = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
    select: { originalVaulterId: true },
  });

  if (!item?.originalVaulterId) return null;

  const shareAmountCents = Math.max(1, Math.round(totalRevenueCents * REVENUE_SHARE_PERCENTAGE));

  return prisma.revenueShare.create({
    data: {
      vaulterId: item.originalVaulterId,
      vaultItemId,
      sourceType,
      sourceId,
      totalRevenueCents,
      shareAmountCents,
    },
  });
}

/**
 * Batch credit all pending revenue shares for a specific user (or all users).
 * Only credits if total pending >= minimum payout threshold.
 * Returns number of shares credited.
 */
export async function creditPendingShares(userId?: string) {
  // Group pending shares by vaulter
  const where = { status: "pending", ...(userId ? { vaulterId: userId } : {}) };

  const pendingByVaulter = await prisma.revenueShare.groupBy({
    by: ["vaulterId"],
    where,
    _sum: { shareAmountCents: true },
  });

  let totalCredited = 0;

  for (const group of pendingByVaulter) {
    const totalCents = group._sum.shareAmountCents || 0;
    if (totalCents < MIN_PAYOUT_CENTS) continue;

    // Credit the user's wallet
    const updatedUser = await prisma.user.update({
      where: { id: group.vaulterId },
      data: { balanceCents: { increment: totalCents } },
      select: { balanceCents: true },
    });

    // Mark all pending shares as credited
    const result = await prisma.revenueShare.updateMany({
      where: { vaulterId: group.vaulterId, status: "pending" },
      data: { status: "credited", creditedAt: new Date() },
    });

    // Log wallet transaction
    await prisma.walletTransaction.create({
      data: {
        userId: group.vaulterId,
        type: "revenue_share",
        amountCents: totalCents,
        balanceAfterCents: updatedUser.balanceCents,
        description: `Revenue share payout (${result.count} transactions)`,
        referenceType: "revenue_share",
      },
    });

    totalCredited += result.count;
  }

  return totalCredited;
}
