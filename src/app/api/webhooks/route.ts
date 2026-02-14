import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

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
  }

  return NextResponse.json({ received: true });
}
