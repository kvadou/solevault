import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { calculateFees } from "@/lib/utils";

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
          unit_amount: fees.totalBuyerPays,
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
