import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sneaker = await prisma.sneaker.findUnique({
    where: { id },
    include: {
      vaultItems: {
        where: { status: "listed" },
        include: {
          listings: { where: { status: "active" }, select: { id: true, priceCents: true, createdAt: true } },
          owner: { select: { id: true, name: true } },
        },
      },
      priceHistory: {
        orderBy: { recordedAt: "desc" },
        take: 30,
      },
    },
  });

  if (!sneaker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Compute market stats from price history
  const history = sneaker.priceHistory;
  const lastSalePriceCents = history.length > 0 ? history[0].priceCents : null;
  const avgSalePriceCents =
    history.length > 0
      ? Math.round(history.reduce((sum, h) => sum + h.priceCents, 0) / history.length)
      : null;
  const lowestSalePriceCents =
    history.length > 0 ? Math.min(...history.map((h) => h.priceCents)) : null;
  const highestSalePriceCents =
    history.length > 0 ? Math.max(...history.map((h) => h.priceCents)) : null;

  const totalSold = await prisma.order.count({
    where: {
      vaultItem: { sneakerId: id },
      status: "completed",
    },
  });

  // Count ALL vaulted items (not just listed)
  const totalVaultItems = await prisma.vaultItem.count({
    where: { sneakerId: id, status: { in: ["vaulted", "listed"] } },
  });

  // Count active listings
  const activeListingsCount = await prisma.listing.count({
    where: {
      vaultItem: { sneakerId: id },
      status: "active",
    },
  });

  // Find lowest ask (cheapest active listing)
  const lowestListing = await prisma.listing.findFirst({
    where: {
      vaultItem: { sneakerId: id },
      status: "active",
    },
    orderBy: { priceCents: "asc" },
    select: { priceCents: true },
  });
  const lowestAskCents = lowestListing?.priceCents ?? null;

  // Check watchlist status for current user
  const session = await auth();
  let isWatching = false;
  let watchlistId: string | null = null;
  if (session?.user?.id) {
    const watchEntry = await prisma.watchlist.findUnique({
      where: {
        userId_sneakerId: {
          userId: session.user.id,
          sneakerId: id,
        },
      },
      select: { id: true },
    });
    if (watchEntry) {
      isWatching = true;
      watchlistId = watchEntry.id;
    }
  }

  return NextResponse.json({
    ...sneaker,
    marketStats: {
      lastSalePriceCents,
      avgSalePriceCents,
      lowestSalePriceCents,
      highestSalePriceCents,
      totalSold,
      totalVaultItems,
      activeListingsCount,
      lowestAskCents,
    },
    isWatching,
    watchlistId,
  });
}
