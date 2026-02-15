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
  });

  if (vaultItems.length === 0) {
    return NextResponse.json({
      totalValueCents: 0,
      totalCostCents: 0,
      totalGainCents: 0,
      itemCount: 0,
      items: [],
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

  return NextResponse.json({
    totalValueCents,
    totalCostCents,
    totalGainCents,
    itemCount: items.length,
    items,
  });
}
