import { prisma } from "@/lib/prisma";

/**
 * Trust Score: 5-factor weighted composite (0-100)
 *
 * | Factor              | Weight | Calculation                                                |
 * |---------------------|--------|------------------------------------------------------------|
 * | Auth pass rate      | 35%    | (certificates scoring 90+) / (total submitted) × 100      |
 * | Transaction history | 25%    | (completed sales without disputes) / (total sales) × 100  |
 * | Condition accuracy  | 20%    | Placeholder — always 100 until buyer condition reports exist|
 * | Response time       | 10%    | Ship within 24h=100, 48h=75, 72h=50, 72h+=25             |
 * | Account age         | 10%    | Log scale: 30d=40, 90d=60, 180d=80, 365d+=100            |
 */

interface TrustScoreBreakdown {
  authPassRate: number;
  transactionScore: number;
  conditionAccuracy: number;
  responseTime: number;
  accountAge: number;
  totalScore: number;
}

export async function calculateTrustScore(userId: string): Promise<TrustScoreBreakdown> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      totalSales: true,
    },
  });

  if (!user) throw new Error(`User ${userId} not found`);

  // Factor 1: Auth pass rate (35%)
  const certificates = await prisma.authenticationCertificate.findMany({
    where: {
      vaultItem: { ownerId: userId },
      status: { in: ["verified", "needs_review", "failed"] },
    },
    select: { confidenceScore: true },
  });

  let authPassRate = 100; // Default for users with no submissions
  if (certificates.length > 0) {
    const passed = certificates.filter((c) => c.confidenceScore !== null && c.confidenceScore >= 90).length;
    authPassRate = Math.round((passed / certificates.length) * 100);
  }

  // Factor 2: Transaction history (25%)
  const totalOrders = await prisma.order.count({
    where: { sellerId: userId, status: "completed" },
  });
  // For now, all completed orders count as non-disputed (no dispute model yet)
  const transactionScore = totalOrders > 0 ? 100 : (user.totalSales > 0 ? 100 : 50);

  // Factor 3: Condition accuracy (20%)
  // Placeholder — requires buyer-side condition confirmation to compare
  const conditionAccuracy = 100;

  // Factor 4: Response time (10%)
  // Placeholder — requires shipping tracking data
  // Default to 75 (48h equivalent) for active sellers, 50 for new
  const responseTime = user.totalSales > 0 ? 75 : 50;

  // Factor 5: Account age (10%)
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  let accountAge: number;
  if (daysSinceCreation >= 365) accountAge = 100;
  else if (daysSinceCreation >= 180) accountAge = 80;
  else if (daysSinceCreation >= 90) accountAge = 60;
  else if (daysSinceCreation >= 30) accountAge = 40;
  else accountAge = 20;

  // Weighted sum
  const totalScore = Math.round(
    authPassRate * 0.35 +
    transactionScore * 0.25 +
    conditionAccuracy * 0.20 +
    responseTime * 0.10 +
    accountAge * 0.10
  );

  return {
    authPassRate,
    transactionScore,
    conditionAccuracy,
    responseTime,
    accountAge,
    totalScore: Math.min(100, Math.max(0, totalScore)),
  };
}

export async function updateUserTrustScore(userId: string): Promise<number> {
  const breakdown = await calculateTrustScore(userId);

  const certificates = await prisma.authenticationCertificate.count({
    where: {
      vaultItem: { ownerId: userId },
      status: "verified",
    },
  });

  const totalSubmitted = await prisma.authenticationCertificate.count({
    where: {
      vaultItem: { ownerId: userId },
      status: { in: ["verified", "needs_review", "failed"] },
    },
  });

  const disputeRate = 0; // Placeholder until dispute model exists

  await prisma.user.update({
    where: { id: userId },
    data: {
      trustScore: breakdown.totalScore,
      trustTotalVerified: certificates,
      trustDisputeRate: disputeRate,
      authPassRate: totalSubmitted > 0 ? breakdown.authPassRate : null,
      trustLastCalculatedAt: new Date(),
    },
  });

  return breakdown.totalScore;
}

/**
 * Recalculate trust scores for all users who have sold at least one item
 * or submitted at least one verification.
 */
export async function recalculateAllTrustScores(): Promise<{ updated: number; errors: number }> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { totalSales: { gt: 0 } },
        { vaultItems: { some: { certificates: { some: {} } } } },
      ],
    },
    select: { id: true },
  });

  let updated = 0;
  let errors = 0;

  for (const user of users) {
    try {
      await updateUserTrustScore(user.id);
      updated++;
    } catch (err) {
      console.error(`Failed to update trust score for user ${user.id}:`, err);
      errors++;
    }
  }

  return { updated, errors };
}

/**
 * Trust score enforcement tiers
 */
export type TrustTier = "excellent" | "good" | "warning" | "restricted" | "suspended";

export function getTrustTier(score: number | null): TrustTier {
  if (score === null) return "good"; // New users default to good
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "warning";
  if (score >= 30) return "restricted";
  return "suspended";
}

export function getMaxActiveListings(tier: TrustTier): number | null {
  if (tier === "restricted") return 5;
  if (tier === "suspended") return 0;
  return null; // No limit
}

export const TRUST_TIER_LABELS: Record<TrustTier, { label: string; color: string; description: string }> = {
  excellent: { label: "Excellent", color: "text-green-600", description: "Trusted seller" },
  good: { label: "Good", color: "text-blue-600", description: "Normal marketplace access" },
  warning: { label: "Warning", color: "text-yellow-600", description: "Improve your trust score" },
  restricted: { label: "Restricted", color: "text-orange-600", description: "Limited to 5 active listings" },
  suspended: { label: "Suspended", color: "text-red-600", description: "Cannot list items" },
};
