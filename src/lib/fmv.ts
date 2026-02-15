import { prisma } from "./prisma";

const BUYBACK_RATE = 0.85; // 85% of FMV
const PLATFORM_SPREAD = 0.15; // 15% kept by platform

/**
 * Calculate Fair Market Value for a vault item.
 *
 * Priority:
 * 1. Admin override (fmvOverrideCents on VaultItem)
 * 2. Weighted average of last 5 platform sales (most recent weighted 2x)
 * 3. Fallback to sneaker retail price
 */
export async function calculateFMV(
  sneakerId: string,
  size: string,
  overrideCents?: number | null,
  retailPriceCents?: number | null
): Promise<number> {
  // 1. Admin override takes priority
  if (overrideCents && overrideCents > 0) {
    return overrideCents;
  }

  // 2. Weighted average of last 5 sales on platform
  const recentSales = await prisma.priceHistory.findMany({
    where: {
      sneakerId,
      size,
      source: "platform",
    },
    orderBy: { recordedAt: "desc" },
    take: 5,
  });

  if (recentSales.length >= 3) {
    // Recency-weighted average: most recent gets 2x weight
    let totalWeight = 0;
    let weightedSum = 0;

    recentSales.forEach((sale, index) => {
      const weight = index === 0 ? 2 : 1; // Most recent gets 2x
      weightedSum += sale.priceCents * weight;
      totalWeight += weight;
    });

    return Math.round(weightedSum / totalWeight);
  }

  // 3. Fallback to retail price
  if (retailPriceCents && retailPriceCents > 0) {
    return retailPriceCents;
  }

  // Absolute fallback
  return 0;
}

/**
 * Calculate buyback payout and platform revenue from FMV.
 */
export function calculateBuybackAmounts(fmvCents: number) {
  const payoutCents = Math.round(fmvCents * BUYBACK_RATE);
  const platformRevenueCents = fmvCents - payoutCents;

  return { fmvCents, payoutCents, platformRevenueCents, rate: BUYBACK_RATE, spread: PLATFORM_SPREAD };
}
