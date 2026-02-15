import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTrustTier, TRUST_TIER_LABELS } from "@/lib/trust-score";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      sellerLevel: true,
      totalSales: true,
      trustScore: true,
      trustTotalVerified: true,
      trustDisputeRate: true,
      authPassRate: true,
      trustLastCalculatedAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = getTrustTier(user.trustScore);
  const tierInfo = TRUST_TIER_LABELS[tier];

  // Get recent verified certificates for this seller
  const recentCertificates = await prisma.authenticationCertificate.findMany({
    where: {
      vaultItem: { ownerId: userId },
      status: "verified",
    },
    select: {
      id: true,
      confidenceScore: true,
      verifiedAt: true,
      sneaker: {
        select: { brand: true, model: true, imageUrl: true },
      },
    },
    orderBy: { verifiedAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    sellerLevel: user.sellerLevel,
    totalSales: user.totalSales,
    trustScore: user.trustScore,
    trustTier: tier,
    trustTierLabel: tierInfo.label,
    trustTierDescription: tierInfo.description,
    totalVerified: user.trustTotalVerified,
    disputeRate: user.trustDisputeRate,
    authPassRate: user.authPassRate,
    memberSince: user.createdAt,
    lastCalculated: user.trustLastCalculatedAt,
    recentCertificates: recentCertificates.map((c) => ({
      id: c.id,
      confidenceScore: c.confidenceScore,
      verifiedAt: c.verifiedAt,
      sneaker: c.sneaker,
    })),
  });
}
