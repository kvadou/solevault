import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;

  // Fetch all vault items owned by the user that are actively held
  const vaultItems = await prisma.vaultItem.findMany({
    where: {
      ownerId: userId,
      status: { in: ["vaulted", "listed", "packed"] },
    },
    include: {
      sneaker: {
        select: {
          id: true,
          brand: true,
          model: true,
          colorway: true,
          imageUrl: true,
          retailPriceCents: true,
        },
      },
    },
    take: 500,
  });

  if (vaultItems.length === 0) {
    return NextResponse.json({
      totalValueCents: 0,
      totalCostCents: 0,
      totalGainCents: 0,
      itemCount: 0,
      items: [],
      history: [],
    });
  }

  // Collect unique sneaker+size combos for batch queries
  const sneakerSizePairs = [
    ...new Set(vaultItems.map((vi) => `${vi.sneakerId}|${vi.size}`)),
  ].map((pair) => {
    const [sneakerId, size] = pair.split("|");
    return { sneakerId, size };
  });

  // Batch fetch: lowest active listing price per sneaker+size
  const lowestListings = await prisma.$queryRawUnsafe<
    { sneakerId: string; size: string; minPriceCents: number }[]
  >(
    `
    SELECT s."id" AS "sneakerId", vi."size", MIN(l."priceCents") AS "minPriceCents"
    FROM "Listing" l
    JOIN "VaultItem" vi ON vi."id" = l."vaultItemId"
    JOIN "Sneaker" s ON s."id" = vi."sneakerId"
    WHERE l."status" = 'active'
      AND (${sneakerSizePairs
        .map(
          (_, i) =>
            `(s."id" = $${i * 2 + 1} AND vi."size" = $${i * 2 + 2})`
        )
        .join(" OR ")})
    GROUP BY s."id", vi."size"
    `,
    ...sneakerSizePairs.flatMap((p) => [p.sneakerId, p.size])
  );

  const listingPriceMap = new Map<string, number>();
  for (const row of lowestListings) {
    listingPriceMap.set(
      `${row.sneakerId}|${row.size}`,
      Number(row.minPriceCents)
    );
  }

  // Batch fetch: most recent PriceHistory per sneaker+size
  // Use DISTINCT ON to get the latest record per sneaker+size
  const latestPriceHistories = await prisma.$queryRawUnsafe<
    { sneakerId: string; size: string; priceCents: number }[]
  >(
    `
    SELECT DISTINCT ON ("sneakerId", "size") "sneakerId", "size", "priceCents"
    FROM "PriceHistory"
    WHERE (${sneakerSizePairs
      .map(
        (_, i) =>
          `("sneakerId" = $${i * 2 + 1} AND "size" = $${i * 2 + 2})`
      )
      .join(" OR ")})
    ORDER BY "sneakerId", "size", "recordedAt" DESC
    `,
    ...sneakerSizePairs.flatMap((p) => [p.sneakerId, p.size])
  );

  const priceHistoryMap = new Map<string, number>();
  for (const row of latestPriceHistories) {
    priceHistoryMap.set(
      `${row.sneakerId}|${row.size}`,
      Number(row.priceCents)
    );
  }

  // Batch fetch: cost basis — most recent completed order where user is buyer for each vault item
  const vaultItemIds = vaultItems.map((vi) => vi.id);
  const costBasisOrders = await prisma.order.findMany({
    where: {
      buyerId: userId,
      vaultItemId: { in: vaultItemIds },
      status: "completed",
    },
    orderBy: { createdAt: "desc" },
    select: {
      vaultItemId: true,
      salePriceCents: true,
      buyerFeeCents: true,
      createdAt: true,
    },
  });

  // Keep only the most recent order per vault item
  const costBasisMap = new Map<
    string,
    { salePriceCents: number; buyerFeeCents: number }
  >();
  for (const order of costBasisOrders) {
    if (!costBasisMap.has(order.vaultItemId)) {
      costBasisMap.set(order.vaultItemId, {
        salePriceCents: order.salePriceCents,
        buyerFeeCents: order.buyerFeeCents,
      });
    }
  }

  // Build per-item data
  const items = vaultItems.map((vi) => {
    const key = `${vi.sneakerId}|${vi.size}`;

    // Current value: lowest active listing > latest price history > asking price > retail price > 0
    const currentValueCents =
      listingPriceMap.get(key) ??
      priceHistoryMap.get(key) ??
      vi.askingPriceCents ??
      vi.sneaker.retailPriceCents ??
      0;

    // Cost basis: most recent completed buy order, or 0 if submitted directly
    const costOrder = costBasisMap.get(vi.id);
    const costBasisCents = costOrder
      ? costOrder.salePriceCents + costOrder.buyerFeeCents
      : 0;

    const gainCents = currentValueCents - costBasisCents;
    const gainPercent =
      costBasisCents > 0 ? Math.round((gainCents / costBasisCents) * 100) : null;

    return {
      id: vi.id,
      size: vi.size,
      condition: vi.condition,
      status: vi.status,
      sneaker: {
        brand: vi.sneaker.brand,
        model: vi.sneaker.model,
        colorway: vi.sneaker.colorway,
        imageUrl: vi.sneaker.imageUrl,
      },
      currentValueCents,
      costBasisCents,
      gainCents,
      gainPercent,
    };
  });

  const totalValueCents = items.reduce((sum, i) => sum + i.currentValueCents, 0);
  const totalCostCents = items.reduce((sum, i) => sum + i.costBasisCents, 0);
  const totalGainCents = totalValueCents - totalCostCents;

  // --- Build 30-day portfolio value history ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const uniqueSneakerIds = [...new Set(vaultItems.map((vi) => vi.sneakerId))];

  const priceHistoryRecords = await prisma.priceHistory.findMany({
    where: {
      sneakerId: { in: uniqueSneakerIds },
      recordedAt: { gte: thirtyDaysAgo },
    },
    orderBy: { recordedAt: "asc" },
    select: {
      sneakerId: true,
      size: true,
      priceCents: true,
      recordedAt: true,
    },
  });

  // Build a map: "sneakerId|size" -> sorted array of { date, priceCents }
  const historyBySneakerSize = new Map<
    string,
    Array<{ date: string; priceCents: number }>
  >();
  for (const rec of priceHistoryRecords) {
    const key = `${rec.sneakerId}|${rec.size}`;
    const dateStr = rec.recordedAt.toISOString().slice(0, 10);
    if (!historyBySneakerSize.has(key)) {
      historyBySneakerSize.set(key, []);
    }
    historyBySneakerSize.get(key)!.push({
      date: dateStr,
      priceCents: rec.priceCents,
    });
  }

  // For each vault item, determine its baseline value (retail or cost basis fallback)
  const itemBaselines = vaultItems.map((vi) => {
    const key = `${vi.sneakerId}|${vi.size}`;
    const currentValue =
      listingPriceMap.get(key) ??
      priceHistoryMap.get(key) ??
      vi.askingPriceCents ??
      vi.sneaker.retailPriceCents ??
      0;
    const baseline = vi.sneaker.retailPriceCents ?? currentValue;
    return { key, baseline, currentValue };
  });

  // Generate daily snapshots for the past 30 days
  const history: Array<{ date: string; valueCents: number }> = [];
  const today = new Date();
  for (let d = 0; d <= 30; d++) {
    const target = new Date(thirtyDaysAgo);
    target.setDate(thirtyDaysAgo.getDate() + d);
    if (target > today) break;
    const dateStr = target.toISOString().slice(0, 10);

    let dayTotal = 0;
    for (const item of itemBaselines) {
      const records = historyBySneakerSize.get(item.key);
      if (records && records.length > 0) {
        // Find the most recent price on or before this date
        let price: number | null = null;
        for (let i = records.length - 1; i >= 0; i--) {
          if (records[i].date <= dateStr) {
            price = records[i].priceCents;
            break;
          }
        }
        if (price !== null) {
          dayTotal += price;
        } else {
          // No price data yet for this date — use baseline
          dayTotal += item.baseline;
        }
      } else {
        // No price history at all — interpolate between baseline and current
        const progress = d / 30;
        dayTotal += Math.round(
          item.baseline + (item.currentValue - item.baseline) * progress
        );
      }
    }

    history.push({ date: dateStr, valueCents: dayTotal });
  }

  return NextResponse.json({
    totalValueCents,
    totalCostCents,
    totalGainCents,
    itemCount: items.length,
    items,
    history,
  });
}
