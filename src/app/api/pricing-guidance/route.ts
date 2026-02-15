import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const CONDITION_MULTIPLIERS: Record<string, number> = {
  deadstock: 1.0,
  vnds: 0.92,
  excellent: 0.82,
  good: 0.7,
};

const VALID_CONDITIONS = Object.keys(CONDITION_MULTIPLIERS);

function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

function calculateMedian(sorted: number[]): number {
  return calculatePercentile(sorted, 50);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sneakerId = searchParams.get("sneakerId");
  const size = searchParams.get("size");
  const condition = searchParams.get("condition") || "deadstock";

  if (!sneakerId || !size) {
    return NextResponse.json(
      { error: "sneakerId and size are required" },
      { status: 400 }
    );
  }

  if (!VALID_CONDITIONS.includes(condition)) {
    return NextResponse.json(
      { error: `Invalid condition. Must be one of: ${VALID_CONDITIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const conditionMultiplier = CONDITION_MULTIPLIERS[condition];

  // Step 1: Find completed orders for VaultItems matching sneaker+size (last 90 days)
  const completedOrders = await prisma.order.findMany({
    where: {
      status: "completed",
      createdAt: { gte: ninetyDaysAgo },
      vaultItem: {
        sneakerId,
        size,
      },
    },
    select: { salePriceCents: true },
  });

  // Step 2: Query PriceHistory for this sneaker+size (last 90 days)
  const priceHistoryRecords = await prisma.priceHistory.findMany({
    where: {
      sneakerId,
      size,
      recordedAt: { gte: ninetyDaysAgo },
    },
    select: { priceCents: true },
  });

  // Step 3: Combine all price data points
  const allPrices = [
    ...completedOrders.map((o) => o.salePriceCents),
    ...priceHistoryRecords.map((p) => p.priceCents),
  ];

  // If we have sales/price history data, calculate from that
  if (allPrices.length > 0) {
    const sorted = [...allPrices].sort((a, b) => a - b);

    const rawMedian = calculateMedian(sorted);
    const rawLow = calculatePercentile(sorted, 25);
    const rawHigh = calculatePercentile(sorted, 75);

    return NextResponse.json({
      suggestedLowCents: Math.round(rawLow * conditionMultiplier),
      suggestedHighCents: Math.round(rawHigh * conditionMultiplier),
      medianCents: Math.round(rawMedian * conditionMultiplier),
      recentSalesCount: completedOrders.length,
      dataSource: "sales" as const,
    });
  }

  // Step 6a: Fall back to active listings for the same sneaker+size
  const activeListings = await prisma.listing.findMany({
    where: {
      status: "active",
      vaultItem: {
        sneakerId,
        size,
      },
    },
    select: { priceCents: true },
  });

  if (activeListings.length > 0) {
    const listingPrices = activeListings
      .map((l) => l.priceCents)
      .sort((a, b) => a - b);

    const rawMedian = calculateMedian(listingPrices);
    const rawLow = calculatePercentile(listingPrices, 25);
    const rawHigh = calculatePercentile(listingPrices, 75);

    return NextResponse.json({
      suggestedLowCents: Math.round(rawLow * conditionMultiplier),
      suggestedHighCents: Math.round(rawHigh * conditionMultiplier),
      medianCents: Math.round(rawMedian * conditionMultiplier),
      recentSalesCount: 0,
      dataSource: "listings" as const,
    });
  }

  // Step 6b: Fall back to retail price
  const sneaker = await prisma.sneaker.findUnique({
    where: { id: sneakerId },
    select: { retailPriceCents: true },
  });

  if (!sneaker) {
    return NextResponse.json({ error: "Sneaker not found" }, { status: 404 });
  }

  const retailPrice = sneaker.retailPriceCents ?? 0;
  const adjustedRetail = Math.round(retailPrice * conditionMultiplier);

  return NextResponse.json({
    suggestedLowCents: Math.round(adjustedRetail * 0.85),
    suggestedHighCents: Math.round(adjustedRetail * 1.15),
    medianCents: adjustedRetail,
    recentSalesCount: 0,
    dataSource: "retail" as const,
  });
}
