import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tiers = await prisma.packTier.findMany({
    where: { status: { in: ["active", "sold_out"] }, dropId: null },
    orderBy: { priceCents: "asc" },
    take: 100,
    include: {
      poolItems: {
        where: { status: "available" },
        include: {
          vaultItem: {
            include: { sneaker: true },
          },
        },
      },
      _count: {
        select: { poolItems: { where: { status: "available" } } },
      },
    },
  });

  // Calculate odds brackets for each tier
  const tiersWithOdds = tiers.map((tier) => {
    const availableItems = tier.poolItems;
    const totalWeight = availableItems.reduce((sum, item) => sum + item.oddsWeight, 0);

    // Group by value bracket
    const brackets: { label: string; percentage: number }[] = [];
    if (totalWeight > 0) {
      const groups = { premium: 0, mid: 0, standard: 0 };
      for (const item of availableItems) {
        const value = item.vaultItem.sneaker.retailPriceCents ?? 0;
        if (value >= tier.priceCents * 2) {
          groups.premium += item.oddsWeight;
        } else if (value >= tier.priceCents) {
          groups.mid += item.oddsWeight;
        } else {
          groups.standard += item.oddsWeight;
        }
      }

      if (groups.premium > 0) {
        brackets.push({ label: `${((tier.priceCents * 2) / 100).toFixed(0)}+ value`, percentage: Math.round((groups.premium / totalWeight) * 100) });
      }
      if (groups.mid > 0) {
        brackets.push({ label: `${(tier.priceCents / 100).toFixed(0)}-${((tier.priceCents * 2) / 100).toFixed(0)} value`, percentage: Math.round((groups.mid / totalWeight) * 100) });
      }
      if (groups.standard > 0) {
        brackets.push({ label: `Under $${(tier.priceCents / 100).toFixed(0)} value`, percentage: Math.round((groups.standard / totalWeight) * 100) });
      }
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

  return NextResponse.json(tiersWithOdds);
}
