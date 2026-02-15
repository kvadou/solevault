import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { createOwnershipRecord } from "@/lib/ownership";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Handle wallet deposits
    if (session.metadata?.type === "wallet_deposit") {
      const userId = session.metadata.userId;
      const amountCents = parseInt(session.metadata.amountCents);

      if (userId && amountCents) {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { balanceCents: { increment: amountCents } },
          select: { balanceCents: true },
        });

        await prisma.walletTransaction.create({
          data: {
            userId,
            type: "deposit",
            amountCents,
            balanceAfterCents: updatedUser.balanceCents,
            description: `Wallet deposit of $${(amountCents / 100).toFixed(2)}`,
            stripePaymentIntentId: session.payment_intent as string,
          },
        });
      }

      return NextResponse.json({ received: true });
    }

    // Handle marketplace orders
    const orderId = session.metadata?.orderId;

    if (!orderId) return NextResponse.json({ received: true });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "pending") return NextResponse.json({ received: true });

    await prisma.$transaction([
      // Mark order paid
      prisma.order.update({
        where: { id: orderId },
        data: {
          status: "completed",
          stripePaymentIntentId: session.payment_intent as string,
        },
      }),
      // Transfer vault item ownership
      prisma.vaultItem.update({
        where: { id: order.vaultItemId },
        data: { ownerId: order.buyerId, status: "vaulted", askingPriceCents: null },
      }),
      // Mark listing as sold
      prisma.listing.update({
        where: { id: order.listingId },
        data: { status: "sold" },
      }),
      // Credit seller balance (sale price minus seller fee)
      prisma.user.update({
        where: { id: order.sellerId },
        data: { balanceCents: { increment: order.salePriceCents - order.sellerFeeCents } },
      }),
    ]);

    // Record ownership transfer
    await createOwnershipRecord({
      vaultItemId: order.vaultItemId,
      fromUserId: order.sellerId,
      toUserId: order.buyerId,
      eventType: "marketplace_sale",
      orderId: order.id,
    });

    // Record price history
    const vaultItemData = await prisma.vaultItem.findUnique({
      where: { id: order.vaultItemId },
      select: { sneakerId: true, size: true },
    });

    if (vaultItemData) {
      await prisma.priceHistory.create({
        data: {
          sneakerId: vaultItemData.sneakerId,
          size: vaultItemData.size,
          priceCents: order.salePriceCents,
          source: "platform",
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
