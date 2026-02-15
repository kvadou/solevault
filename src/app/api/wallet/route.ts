import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: { balanceCents: true },
  });

  const recentTransactions = await prisma.walletTransaction.findMany({
    where: { userId: session.user.id! },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    balanceCents: user?.balanceCents ?? 0,
    recentTransactions,
  });
}
