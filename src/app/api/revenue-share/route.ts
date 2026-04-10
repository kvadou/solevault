import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all revenue shares for this user as a vaulter
  const shares = await prisma.revenueShare.findMany({
    where: { vaulterId: session.user.id! },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      vaultItem: {
        include: { sneaker: true },
      },
    },
  });

  // Calculate totals
  const totals = await prisma.revenueShare.groupBy({
    by: ["status"],
    where: { vaulterId: session.user.id! },
    _sum: { shareAmountCents: true },
    _count: true,
  });

  const pending = totals.find((t) => t.status === "pending");
  const credited = totals.find((t) => t.status === "credited");

  // Get items this user originally vaulted
  const vaultedItems = await prisma.vaultItem.findMany({
    where: { originalVaulterId: session.user.id! },
    include: { sneaker: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Get lifetime revenue generated per item
  const itemRevenue = await prisma.revenueShare.groupBy({
    by: ["vaultItemId"],
    where: { vaulterId: session.user.id! },
    _sum: { totalRevenueCents: true, shareAmountCents: true },
    _count: true,
  });

  const revenueByItem = Object.fromEntries(
    itemRevenue.map((r) => [
      r.vaultItemId,
      {
        totalRevenueCents: r._sum.totalRevenueCents || 0,
        totalShareCents: r._sum.shareAmountCents || 0,
        tradeCount: r._count,
      },
    ])
  );

  return NextResponse.json({
    shares,
    summary: {
      pendingCents: pending?._sum.shareAmountCents || 0,
      pendingCount: pending?._count || 0,
      creditedCents: credited?._sum.shareAmountCents || 0,
      creditedCount: credited?._count || 0,
      totalEarnedCents: (pending?._sum.shareAmountCents || 0) + (credited?._sum.shareAmountCents || 0),
    },
    vaultedItems: vaultedItems.map((item) => ({
      id: item.id,
      sneaker: item.sneaker,
      size: item.size,
      condition: item.condition,
      status: item.status,
      revenue: revenueByItem[item.id] || { totalRevenueCents: 0, totalShareCents: 0, tradeCount: 0 },
    })),
  });
}
