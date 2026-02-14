import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalUsers,
    totalVaultItems,
    activeListings,
    completedOrders,
    totalRevenue,
    pendingSubmissions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.vaultItem.count(),
    prisma.listing.count({ where: { status: "active" } }),
    prisma.order.count({ where: { status: "completed" } }),
    prisma.order.aggregate({ where: { status: "completed" }, _sum: { platformRevenueCents: true } }),
    prisma.vaultSubmission.count({ where: { status: { not: "completed" } } }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalVaultItems,
    activeListings,
    completedOrders,
    totalRevenueCents: totalRevenue._sum.platformRevenueCents || 0,
    pendingSubmissions,
  });
}
