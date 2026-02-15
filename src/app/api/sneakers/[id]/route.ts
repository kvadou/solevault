import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({
    ...sneaker,
    marketStats: {
      lastSalePriceCents,
      avgSalePriceCents,
      lowestSalePriceCents,
      highestSalePriceCents,
      totalSold,
    },
  });
}
