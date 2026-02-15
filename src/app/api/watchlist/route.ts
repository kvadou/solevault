import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watchlist = await prisma.watchlist.findMany({
    where: { userId: session.user.id! },
    include: {
      sneaker: {
        include: {
          vaultItems: {
            where: { status: "listed" },
            include: {
              listings: {
                where: { status: "active" },
                select: { priceCents: true },
                orderBy: { priceCents: "asc" },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Flatten to a cleaner response
  const items = watchlist.map((w) => {
    const lowestAskCents = w.sneaker.vaultItems[0]?.listings[0]?.priceCents ?? null;
    return {
      id: w.id,
      sneakerId: w.sneakerId,
      targetPriceCents: w.targetPriceCents,
      createdAt: w.createdAt,
      sneaker: {
        id: w.sneaker.id,
        brand: w.sneaker.brand,
        model: w.sneaker.model,
        colorway: w.sneaker.colorway,
        imageUrl: w.sneaker.imageUrl,
        retailPriceCents: w.sneaker.retailPriceCents,
      },
      lowestAskCents,
      targetReached: w.targetPriceCents != null && lowestAskCents != null && lowestAskCents <= w.targetPriceCents,
    };
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sneakerId, targetPriceCents } = await req.json();

  if (!sneakerId) {
    return NextResponse.json({ error: "sneakerId is required" }, { status: 400 });
  }

  // Upsert to handle re-adding with different target price
  const entry = await prisma.watchlist.upsert({
    where: {
      userId_sneakerId: {
        userId: session.user.id!,
        sneakerId,
      },
    },
    create: {
      userId: session.user.id!,
      sneakerId,
      targetPriceCents: targetPriceCents ?? null,
    },
    update: {
      targetPriceCents: targetPriceCents ?? null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
