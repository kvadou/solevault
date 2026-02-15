import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { calculateFees } from "@/lib/utils";
import { createOwnershipRecord } from "@/lib/ownership";
import { createRevenueShare } from "@/lib/revenue-share";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: session.user.id! }, { sellerId: session.user.id! }],
    },
    include: {
      vaultItem: { include: { sneaker: true } },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listingId } = await req.json();

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { vaultItem: { include: { sneaker: true } } },
  });

  if (!listing || listing.status !== "active") {
    return NextResponse.json({ error: "Listing not available" }, { status: 400 });
  }

  if (listing.sellerId === session.user.id) {
    return NextResponse.json({ error: "Cannot buy your own listing" }, { status: 400 });
  }

  const fees = calculateFees(listing.priceCents);
  const totalCost = fees.totalBuyerPays;

  // Check wallet balance
  const buyer = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { balanceCents: true },
  });

  const walletBalance = buyer?.balanceCents ?? 0;

  // If wallet covers the full cost, pay entirely from wallet
  if (walletBalance >= totalCost) {
    const updatedBuyer = await prisma.user.update({
      where: { id: session.user.id! },
      data: { balanceCents: { decrement: totalCost } },
      select: { balanceCents: true },
    });

    const order = await prisma.order.create({
      data: {
        listingId: listing.id,
        buyerId: session.user.id!,
        sellerId: listing.sellerId,
        vaultItemId: listing.vaultItemId,
        salePriceCents: listing.priceCents,
        buyerFeeCents: fees.buyerFeeCents,
        sellerFeeCents: fees.sellerFeeCents,
        platformRevenueCents: fees.platformRevenueCents,
        status: "completed",
      },
    });

    // Complete the order immediately — transfer ownership, credit seller
    await prisma.$transaction([
      prisma.vaultItem.update({
        where: { id: listing.vaultItemId },
        data: { ownerId: session.user.id!, status: "vaulted", askingPriceCents: null },
      }),
      prisma.listing.update({
        where: { id: listing.id },
        data: { status: "sold" },
      }),
      prisma.user.update({
        where: { id: listing.sellerId },
        data: { balanceCents: { increment: fees.sellerReceives } },
      }),
    ]);

    // Record ownership transfer
    await createOwnershipRecord({
      vaultItemId: listing.vaultItemId,
      fromUserId: listing.sellerId,
      toUserId: session.user.id!,
      eventType: "marketplace_sale",
      orderId: order.id,
    });

    // Create revenue share for original vaulter (1% of platform revenue)
    await createRevenueShare({
      vaultItemId: listing.vaultItemId,
      sourceType: "marketplace_sale",
      sourceId: order.id,
      totalRevenueCents: fees.platformRevenueCents,
    });

    // Log wallet transactions for buyer and seller
    await prisma.walletTransaction.createMany({
      data: [
        {
          userId: session.user.id!,
          type: "purchase",
          amountCents: -totalCost,
          balanceAfterCents: updatedBuyer.balanceCents,
          description: `Purchased ${listing.vaultItem.sneaker.brand} ${listing.vaultItem.sneaker.model}`,
          referenceType: "order",
          referenceId: order.id,
        },
        {
          userId: listing.sellerId,
          type: "sale",
          amountCents: fees.sellerReceives,
          balanceAfterCents: 0, // Will be slightly off but acceptable — no read-after-write needed
          description: `Sold ${listing.vaultItem.sneaker.brand} ${listing.vaultItem.sneaker.model}`,
          referenceType: "order",
          referenceId: order.id,
        },
      ],
    });

    return NextResponse.json({ success: true, orderId: order.id });
  }

  // Otherwise, fall back to Stripe checkout for the full amount
  const order = await prisma.order.create({
    data: {
      listingId: listing.id,
      buyerId: session.user.id!,
      sellerId: listing.sellerId,
      vaultItemId: listing.vaultItemId,
      salePriceCents: listing.priceCents,
      buyerFeeCents: fees.buyerFeeCents,
      sellerFeeCents: fees.sellerFeeCents,
      platformRevenueCents: fees.platformRevenueCents,
      status: "pending",
    },
  });

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${listing.vaultItem.sneaker.brand} ${listing.vaultItem.sneaker.model}`,
            description: `Size ${listing.vaultItem.size} - ${listing.vaultItem.condition}`,
            images: listing.vaultItem.imageUrls.length > 0 ? [listing.vaultItem.imageUrls[0]] : undefined,
          },
          unit_amount: totalCost,
        },
        quantity: 1,
      },
    ],
    metadata: { orderId: order.id },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/marketplace?cancelled=true`,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: checkoutSession.id },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
