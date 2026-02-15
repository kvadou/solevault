import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSellerLevel, getFeePercent, getNextLevelInfo, SELLER_LEVELS } from "@/lib/seller-levels";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { totalSales: true, authPassRate: true, sellerLevel: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Compute current level from actual sales count (may differ from stored if not updated)
  const computedLevel = getSellerLevel(user.totalSales);
  const feePercent = getFeePercent(computedLevel);
  const nextLevel = getNextLevelInfo(computedLevel, user.totalSales);

  // Update stored level if it changed
  if (computedLevel !== user.sellerLevel) {
    await prisma.user.update({
      where: { id: session.user.id! },
      data: { sellerLevel: computedLevel },
    });
  }

  return NextResponse.json({
    level: computedLevel,
    label: SELLER_LEVELS[computedLevel].label,
    color: SELLER_LEVELS[computedLevel].color,
    feePercent, // seller portion only — buyer always pays an additional 2.5%
    totalSales: user.totalSales,
    authPassRate: user.authPassRate,
    nextLevel: nextLevel ? {
      level: nextLevel.nextLevel,
      label: nextLevel.nextLevel ? SELLER_LEVELS[nextLevel.nextLevel].label : null,
      salesNeeded: nextLevel.salesNeeded,
    } : null,
  });
}
