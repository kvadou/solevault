import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { packTierId } = await req.json();

  if (!packTierId) {
    return NextResponse.json({ error: "Pack tier ID is required" }, { status: 400 });
  }

  // Get tier and check availability
  const tier = await prisma.packTier.findUnique({
    where: { id: packTierId },
    include: { drop: true },
  });

  if (!tier || tier.status !== "active") {
    return NextResponse.json({ error: "Pack not available" }, { status: 400 });
  }

  // If tier belongs to a drop, check drop status and per-user limits
  if (tier.drop) {
    const now = new Date();
    if (tier.drop.status !== "live") {
      if (tier.drop.status === "upcoming" && tier.drop.startsAt <= now) {
        await prisma.drop.update({ where: { id: tier.drop.id }, data: { status: "live" } });
      } else {
        return NextResponse.json({ error: "This drop is not live yet" }, { status: 400 });
      }
    }
    if (tier.drop.endsAt && tier.drop.endsAt <= now) {
      await prisma.drop.update({ where: { id: tier.drop.id }, data: { status: "ended" } });
      return NextResponse.json({ error: "This drop has ended" }, { status: 400 });
    }

    // Per-user purchase limit
    const dropTierIds = await prisma.packTier.findMany({
      where: { dropId: tier.drop.id },
      select: { id: true },
    });
    const userRipCount = await prisma.packRip.count({
      where: {
        userId: session.user.id!,
        packTierId: { in: dropTierIds.map((t) => t.id) },
      },
    });
    if (userRipCount >= tier.drop.maxPurchasesPerUser) {
      return NextResponse.json(
        { error: `Purchase limit reached (${tier.drop.maxPurchasesPerUser} per user)` },
        { status: 400 }
      );
    }
  }

  // Check wallet balance
  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { balanceCents: true },
  });

  if (!user || user.balanceCents < tier.priceCents) {
    return NextResponse.json(
      { error: "Insufficient wallet balance", required: tier.priceCents, current: user?.balanceCents ?? 0 },
      { status: 400 }
    );
  }

  // Get available pool items
  const poolItems = await prisma.packPoolItem.findMany({
    where: { packTierId, status: "available" },
  });

  if (poolItems.length === 0) {
    // Mark tier as sold out
    await prisma.packTier.update({
      where: { id: packTierId },
      data: { status: "sold_out" },
    });
    return NextResponse.json({ error: "Pack is sold out" }, { status: 400 });
  }

  // Weighted random selection
  const totalWeight = poolItems.reduce((sum, item) => sum + item.oddsWeight, 0);
  let random = Math.random() * totalWeight;
  let selectedItem = poolItems[0];
  for (const item of poolItems) {
    random -= item.oddsWeight;
    if (random <= 0) {
      selectedItem = item;
      break;
    }
  }

  // Execute the rip in a transaction
  const updatedUser = await prisma.user.update({
    where: { id: session.user.id! },
    data: { balanceCents: { decrement: tier.priceCents } },
    select: { balanceCents: true },
  });

  const rip = await prisma.packRip.create({
    data: {
      userId: session.user.id!,
      packTierId: tier.id,
      packPoolItemId: selectedItem.id,
      priceCents: tier.priceCents,
      platformRevenueCents: tier.priceCents, // 100% revenue on pack sales
      status: "pending",
    },
  });

  // Mark pool item as claimed
  await prisma.packPoolItem.update({
    where: { id: selectedItem.id },
    data: { status: "claimed", claimedAt: new Date() },
  });

  // Increment sold count
  await prisma.packTier.update({
    where: { id: tier.id },
    data: { soldCount: { increment: 1 } },
  });

  // Log wallet transaction
  await prisma.walletTransaction.create({
    data: {
      userId: session.user.id!,
      type: "purchase",
      amountCents: -tier.priceCents,
      balanceAfterCents: updatedUser.balanceCents,
      description: `Pack rip: ${tier.name}`,
      referenceType: "pack_rip",
      referenceId: rip.id,
    },
  });

  // Check if tier is now sold out
  const remainingCount = await prisma.packPoolItem.count({
    where: { packTierId, status: "available" },
  });
  if (remainingCount === 0) {
    await prisma.packTier.update({
      where: { id: packTierId },
      data: { status: "sold_out" },
    });
  }

  return NextResponse.json({ ripId: rip.id });
}
