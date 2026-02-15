import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Auto-update status
  const now = new Date();
  await prisma.drop.updateMany({
    where: { slug, status: "upcoming", startsAt: { lte: now } },
    data: { status: "live" },
  });
  await prisma.drop.updateMany({
    where: { slug, status: "live", endsAt: { not: null, lte: now } },
    data: { status: "ended" },
  });

  const drop = await prisma.drop.findUnique({
    where: { slug },
    include: {
      packTiers: {
        include: {
          poolItems: {
            where: { status: "available" },
            include: {
              vaultItem: { include: { sneaker: true } },
            },
          },
          _count: {
            select: {
              poolItems: { where: { status: "available" } },
              rips: true,
            },
          },
        },
      },
    },
  });

  if (!drop) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }

  // Check user's purchase count for this drop
  let userPurchaseCount = 0;
  const session = await auth();
  if (session?.user) {
    const tierIds = drop.packTiers.map((t) => t.id);
    if (tierIds.length > 0) {
      userPurchaseCount = await prisma.packRip.count({
        where: {
          userId: session.user.id!,
          packTierId: { in: tierIds },
        },
      });
    }
  }

  // Calculate odds brackets per tier
  const tiersWithOdds = drop.packTiers.map((tier) => {
    const availableItems = tier.poolItems;
    const totalWeight = availableItems.reduce((sum, item) => sum + item.oddsWeight, 0);
    const brackets: { label: string; percentage: number }[] = [];

    if (totalWeight > 0) {
      const groups = { premium: 0, mid: 0, standard: 0 };
      for (const item of availableItems) {
        const value = item.vaultItem.sneaker.retailPriceCents ?? 0;
        if (value >= tier.priceCents * 2) groups.premium += item.oddsWeight;
        else if (value >= tier.priceCents) groups.mid += item.oddsWeight;
        else groups.standard += item.oddsWeight;
      }
      if (groups.premium > 0) brackets.push({ label: `$${((tier.priceCents * 2) / 100).toFixed(0)}+ value`, percentage: Math.round((groups.premium / totalWeight) * 100) });
      if (groups.mid > 0) brackets.push({ label: `$${(tier.priceCents / 100).toFixed(0)}-${((tier.priceCents * 2) / 100).toFixed(0)} value`, percentage: Math.round((groups.mid / totalWeight) * 100) });
      if (groups.standard > 0) brackets.push({ label: `Under $${(tier.priceCents / 100).toFixed(0)} value`, percentage: Math.round((groups.standard / totalWeight) * 100) });
    }

    return {
      id: tier.id,
      name: tier.name,
      slug: tier.slug,
      priceCents: tier.priceCents,
      imageUrl: tier.imageUrl,
      description: tier.description,
      totalSupply: tier.totalSupply,
      soldCount: tier.soldCount,
      remaining: tier._count.poolItems,
      status: tier.status,
      oddsBrackets: brackets,
    };
  });

  return NextResponse.json({
    ...drop,
    packTiers: tiersWithOdds,
    userPurchaseCount,
    canPurchase: userPurchaseCount < drop.maxPurchasesPerUser,
  });
}
