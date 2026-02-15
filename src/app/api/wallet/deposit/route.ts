import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const MIN_DEPOSIT_CENTS = 500; // $5
const MAX_DEPOSIT_CENTS = 50000; // $500

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amountCents } = await req.json();

  if (!amountCents || typeof amountCents !== "number") {
    return NextResponse.json({ error: "Amount is required" }, { status: 400 });
  }

  if (amountCents < MIN_DEPOSIT_CENTS || amountCents > MAX_DEPOSIT_CENTS) {
    return NextResponse.json(
      { error: `Amount must be between $${MIN_DEPOSIT_CENTS / 100} and $${MAX_DEPOSIT_CENTS / 100}` },
      { status: 400 }
    );
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "SoleVault Wallet Deposit",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "wallet_deposit",
      userId: session.user.id!,
      amountCents: amountCents.toString(),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=cancelled`,
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
