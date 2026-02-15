import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateFMV, calculateBuybackAmounts } from "@/lib/fmv";
import { createRevenueShare } from "@/lib/revenue-share";

const PLATFORM_ACCOUNT_EMAIL = "platform@solevault.io";

// GET: Calculate buyback quote for a vault item
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const vaultItemId = searchParams.get("vaultItemId");

  if (!vaultItemId) {
    return NextResponse.json({ error: "vaultItemId is required" }, { status: 400 });
  }

  const item = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
    include: { sneaker: true },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (item.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not your item" }, { status: 403 });
  }

  if (item.status !== "vaulted") {
    return NextResponse.json({ error: "Item must be in vaulted status" }, { status: 400 });
  }

  const fmvCents = await calculateFMV(
    item.sneakerId,
    item.size,
    item.fmvOverrideCents,
    item.sneaker.retailPriceCents
  );

  if (fmvCents <= 0) {
    return NextResponse.json({ error: "Unable to determine fair market value" }, { status: 400 });
  }

  const amounts = calculateBuybackAmounts(fmvCents);

  return NextResponse.json({
    vaultItemId: item.id,
    sneakerName: `${item.sneaker.brand} ${item.sneaker.model}`,
    size: item.size,
    condition: item.condition,
    ...amounts,
  });
}

// POST: Execute buyback
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultItemId } = await req.json();

  if (!vaultItemId) {
    return NextResponse.json({ error: "vaultItemId is required" }, { status: 400 });
  }

  const item = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
    include: { sneaker: true },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (item.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not your item" }, { status: 403 });
  }

  if (item.status !== "vaulted") {
    return NextResponse.json({ error: "Item must be in vaulted status" }, { status: 400 });
  }

  // Calculate FMV and buyback amounts
  const fmvCents = await calculateFMV(
    item.sneakerId,
    item.size,
    item.fmvOverrideCents,
    item.sneaker.retailPriceCents
  );

  if (fmvCents <= 0) {
    return NextResponse.json({ error: "Unable to determine fair market value" }, { status: 400 });
  }

  const { payoutCents, platformRevenueCents } = calculateBuybackAmounts(fmvCents);

  // Get or create platform system account
  let platformAccount = await prisma.user.findUnique({
    where: { email: PLATFORM_ACCOUNT_EMAIL },
  });

  if (!platformAccount) {
    platformAccount = await prisma.user.create({
      data: {
        email: PLATFORM_ACCOUNT_EMAIL,
        name: "SoleVault Platform",
        role: "admin",
      },
    });
  }

  // Execute buyback
  const updatedUser = await prisma.user.update({
    where: { id: session.user.id! },
    data: { balanceCents: { increment: payoutCents } },
    select: { balanceCents: true },
  });

  const buyback = await prisma.buybackTransaction.create({
    data: {
      userId: session.user.id!,
      vaultItemId: item.id,
      fmvCents,
      payoutCents,
      platformRevenueCents,
    },
  });

  // Transfer item to platform account and reset to vaulted
  await prisma.vaultItem.update({
    where: { id: item.id },
    data: {
      ownerId: platformAccount.id,
      status: "vaulted",
      askingPriceCents: null,
    },
  });

  // Log wallet transaction
  await prisma.walletTransaction.create({
    data: {
      userId: session.user.id!,
      type: "buyback",
      amountCents: payoutCents,
      balanceAfterCents: updatedUser.balanceCents,
      description: `Buyback: ${item.sneaker.brand} ${item.sneaker.model} (Size ${item.size})`,
      referenceType: "buyback",
      referenceId: buyback.id,
    },
  });

  // Create revenue share for original vaulter (1% of platform revenue)
  await createRevenueShare({
    vaultItemId: item.id,
    sourceType: "buyback",
    sourceId: buyback.id,
    totalRevenueCents: platformRevenueCents,
  });

  // Record as a platform sale in price history
  await prisma.priceHistory.create({
    data: {
      sneakerId: item.sneakerId,
      size: item.size,
      priceCents: fmvCents,
      source: "platform",
    },
  });

  return NextResponse.json({
    success: true,
    payoutCents,
    fmvCents,
    newBalanceCents: updatedUser.balanceCents,
  });
}
