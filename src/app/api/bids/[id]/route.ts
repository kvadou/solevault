import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateFees } from "@/lib/utils";
import { createOwnershipRecord } from "@/lib/ownership";
import { createRevenueShare } from "@/lib/revenue-share";
import { getSellerLevel, getFeePercent } from "@/lib/seller-levels";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { action } = await req.json();

  if (!action || !["accept", "decline", "cancel"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'accept', 'decline', or 'cancel'" },
      { status: 400 }
    );
  }

  const bid = await prisma.bid.findUnique({
    where: { id },
    include: { sneaker: true },
  });

  if (!bid) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }

  if (bid.status !== "active") {
    return NextResponse.json(
      { error: `Bid is already ${bid.status}` },
      { status: 400 }
    );
  }

  if (bid.expiresAt < new Date()) {
    // Auto-expire the bid
    await prisma.bid.update({
      where: { id },
      data: { status: "expired" },
    });
    return NextResponse.json({ error: "Bid has expired" }, { status: 400 });
  }

  // --- CANCEL ---
  if (action === "cancel") {
    if (bid.bidderId !== session.user.id!) {
      return NextResponse.json(
        { error: "Only the bidder can cancel their bid" },
        { status: 403 }
      );
    }

    const updated = await prisma.bid.update({
      where: { id },
      data: { status: "cancelled" },
      include: {
        sneaker: {
          select: { brand: true, model: true, colorway: true, imageUrl: true },
        },
      },
    });

    return NextResponse.json(updated);
  }

  // --- DECLINE ---
  if (action === "decline") {
    // Verify the authenticated user owns a vaulted/listed item matching the bid's sneaker+size
    const sellerItem = await prisma.vaultItem.findFirst({
      where: {
        ownerId: session.user.id!,
        sneakerId: bid.sneakerId,
        size: bid.size,
        status: { in: ["vaulted", "listed"] },
      },
    });

    if (!sellerItem) {
      return NextResponse.json(
        { error: "You don't own a matching item to decline this bid" },
        { status: 403 }
      );
    }

    const updated = await prisma.bid.update({
      where: { id },
      data: { status: "declined" },
      include: {
        sneaker: {
          select: { brand: true, model: true, colorway: true, imageUrl: true },
        },
      },
    });

    // Notify bidder their offer was declined
    try {
      await prisma.notification.create({
        data: {
          userId: bid.bidderId,
          type: "bid_declined",
          title: "Offer Declined",
          message: `Your offer of $${(bid.amountCents / 100).toFixed(2)} for ${bid.sneaker.brand} ${bid.sneaker.model} was declined`,
          link: `/sneakers/${bid.sneakerId}`,
        },
      });
    } catch {}

    return NextResponse.json(updated);
  }

  // --- ACCEPT ---
  // Verify the seller owns a vaulted item matching the bid's sneaker+size
  const vaultItem = await prisma.vaultItem.findFirst({
    where: {
      ownerId: session.user.id!,
      sneakerId: bid.sneakerId,
      size: bid.size,
      status: "vaulted",
    },
    include: { sneaker: true },
  });

  if (!vaultItem) {
    return NextResponse.json(
      { error: "You don't own a vaulted item matching this bid" },
      { status: 403 }
    );
  }

  // Look up seller's sales count to determine their level and fee rate
  const sellerUser = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { totalSales: true },
  });
  const sellerLevel = getSellerLevel(sellerUser?.totalSales ?? 0);
  const sellerFeePercent = getFeePercent(sellerLevel);
  const fees = calculateFees(bid.amountCents, sellerFeePercent);

  // Check buyer wallet balance
  const buyer = await prisma.user.findUnique({
    where: { id: bid.bidderId },
    select: { balanceCents: true },
  });

  if (!buyer || buyer.balanceCents < fees.totalBuyerPays) {
    return NextResponse.json(
      { error: "Buyer has insufficient wallet balance" },
      { status: 400 }
    );
  }

  // Create a listing for the item (Order requires listingId)
  const listing = await prisma.listing.create({
    data: {
      vaultItemId: vaultItem.id,
      sellerId: session.user.id!,
      priceCents: bid.amountCents,
      status: "sold",
    },
  });

  // Debit buyer, credit seller, transfer ownership in a transaction
  const [updatedBuyer, updatedSeller] = await prisma.$transaction([
    prisma.user.update({
      where: { id: bid.bidderId },
      data: { balanceCents: { decrement: fees.totalBuyerPays } },
      select: { balanceCents: true },
    }),
    prisma.user.update({
      where: { id: session.user.id! },
      data: { balanceCents: { increment: fees.sellerReceives } },
      select: { balanceCents: true },
    }),
    prisma.vaultItem.update({
      where: { id: vaultItem.id },
      data: { ownerId: bid.bidderId, status: "vaulted", askingPriceCents: null },
    }),
  ]);

  // Create order
  const order = await prisma.order.create({
    data: {
      listingId: listing.id,
      buyerId: bid.bidderId,
      sellerId: session.user.id!,
      vaultItemId: vaultItem.id,
      salePriceCents: bid.amountCents,
      buyerFeeCents: fees.buyerFeeCents,
      sellerFeeCents: fees.sellerFeeCents,
      platformRevenueCents: fees.platformRevenueCents,
      status: "completed",
    },
  });

  // Update bid status
  const updatedBid = await prisma.bid.update({
    where: { id },
    data: { status: "accepted", vaultItemId: vaultItem.id },
    include: {
      sneaker: {
        select: { brand: true, model: true, colorway: true, imageUrl: true },
      },
    },
  });

  // Record ownership transfer
  await createOwnershipRecord({
    vaultItemId: vaultItem.id,
    fromUserId: session.user.id!,
    toUserId: bid.bidderId,
    eventType: "marketplace_sale",
    orderId: order.id,
  });

  // Create revenue share for original vaulter
  await createRevenueShare({
    vaultItemId: vaultItem.id,
    sourceType: "marketplace_sale",
    sourceId: order.id,
    totalRevenueCents: fees.platformRevenueCents,
  });

  // Log wallet transactions
  await prisma.walletTransaction.createMany({
    data: [
      {
        userId: bid.bidderId,
        type: "purchase",
        amountCents: -fees.totalBuyerPays,
        balanceAfterCents: updatedBuyer.balanceCents,
        description: `Bid accepted: ${vaultItem.sneaker.brand} ${vaultItem.sneaker.model} Size ${bid.size}`,
        referenceType: "order",
        referenceId: order.id,
      },
      {
        userId: session.user.id!,
        type: "sale",
        amountCents: fees.sellerReceives,
        balanceAfterCents: updatedSeller.balanceCents,
        description: `Sold via bid: ${vaultItem.sneaker.brand} ${vaultItem.sneaker.model} Size ${bid.size}`,
        referenceType: "order",
        referenceId: order.id,
      },
    ],
  });

  // Record price history
  await prisma.priceHistory.create({
    data: {
      sneakerId: bid.sneakerId,
      size: bid.size,
      priceCents: bid.amountCents,
      source: "platform",
    },
  });

  // Increment seller's totalSales and update level if needed
  try {
    const updatedSellerUser = await prisma.user.update({
      where: { id: session.user.id! },
      data: { totalSales: { increment: 1 } },
      select: { totalSales: true },
    });
    const newLevel = getSellerLevel(updatedSellerUser.totalSales);
    if (newLevel !== sellerLevel) {
      await prisma.user.update({
        where: { id: session.user.id! },
        data: { sellerLevel: newLevel },
      });
    }
  } catch {
    // Don't break the order flow if sales count update fails
  }

  // Notify bidder their offer was accepted
  try {
    await prisma.notification.create({
      data: {
        userId: bid.bidderId,
        type: "bid_accepted",
        title: "Offer Accepted!",
        message: `Your offer of $${(bid.amountCents / 100).toFixed(2)} for ${bid.sneaker.brand} ${bid.sneaker.model} was accepted`,
        link: "/vault",
      },
    });
  } catch {}

  return NextResponse.json(updatedBid);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bid = await prisma.bid.findUnique({ where: { id } });

  if (!bid) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }

  if (bid.bidderId !== session.user.id!) {
    return NextResponse.json(
      { error: "Only the bidder can cancel their bid" },
      { status: 403 }
    );
  }

  if (bid.status !== "active") {
    return NextResponse.json(
      { error: `Bid is already ${bid.status}` },
      { status: 400 }
    );
  }

  const updated = await prisma.bid.update({
    where: { id },
    data: { status: "cancelled" },
    include: {
      sneaker: {
        select: { brand: true, model: true, colorway: true, imageUrl: true },
      },
    },
  });

  return NextResponse.json(updated);
}
