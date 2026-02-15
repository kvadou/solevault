import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const MIN_WITHDRAWAL_CENTS = 1000; // $10
const WITHDRAWAL_FEE_CENTS = 150; // $1.50

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amountCents } = await req.json();

  if (!amountCents || typeof amountCents !== "number") {
    return NextResponse.json({ error: "Amount is required" }, { status: 400 });
  }

  if (amountCents < MIN_WITHDRAWAL_CENTS) {
    return NextResponse.json(
      { error: `Minimum withdrawal is $${MIN_WITHDRAWAL_CENTS / 100}` },
      { status: 400 }
    );
  }

  const totalDeduction = amountCents + WITHDRAWAL_FEE_CENTS;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { balanceCents: true, stripeConnectAccountId: true },
  });

  if (!user || user.balanceCents < totalDeduction) {
    return NextResponse.json(
      { error: `Insufficient balance. You need $${(totalDeduction / 100).toFixed(2)} (includes $1.50 fee)` },
      { status: 400 }
    );
  }

  // Create or retrieve Stripe Connect account
  let connectAccountId = user.stripeConnectAccountId;

  if (!connectAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { userId: session.user.id! },
    });
    connectAccountId = account.id;

    await prisma.user.update({
      where: { id: session.user.id! },
      data: { stripeConnectAccountId: connectAccountId },
    });

    // Return onboarding link for first-time setup
    const accountLink = await stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?connect=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?connect=complete`,
      type: "account_onboarding",
    });

    return NextResponse.json({ onboardingUrl: accountLink.url });
  }

  // Check if Connect account is ready for payouts
  const account = await stripe.accounts.retrieve(connectAccountId);
  if (!account.payouts_enabled) {
    const accountLink = await stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?connect=refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?connect=complete`,
      type: "account_onboarding",
    });
    return NextResponse.json({ onboardingUrl: accountLink.url });
  }

  // Process withdrawal
  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: "usd",
    destination: connectAccountId,
  });

  // Deduct balance and log transaction
  const updatedUser = await prisma.user.update({
    where: { id: session.user.id! },
    data: { balanceCents: { decrement: totalDeduction } },
    select: { balanceCents: true },
  });

  await prisma.walletTransaction.create({
    data: {
      userId: session.user.id!,
      type: "withdrawal",
      amountCents: -totalDeduction,
      balanceAfterCents: updatedUser.balanceCents,
      description: `Withdrawal of $${(amountCents / 100).toFixed(2)} (fee: $1.50)`,
      stripeTransferId: transfer.id,
    },
  });

  return NextResponse.json({
    success: true,
    withdrawnCents: amountCents,
    feeCents: WITHDRAWAL_FEE_CENTS,
    newBalanceCents: updatedUser.balanceCents,
  });
}
