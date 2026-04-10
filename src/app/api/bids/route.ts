import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") || "buyer";

  if (role === "seller") {
    // Find bids on sneakers where the user has vaulted/listed items matching sneaker+size
    const userVaultItems = await prisma.vaultItem.findMany({
      where: {
        ownerId: session.user.id!,
        status: { in: ["vaulted", "listed"] },
      },
      select: { sneakerId: true, size: true },
    });

    if (userVaultItems.length === 0) {
      return NextResponse.json([]);
    }

    // Build OR conditions for each sneaker+size combination the seller owns
    const sneakerSizeConditions = userVaultItems.map((item) => ({
      sneakerId: item.sneakerId,
      size: item.size,
    }));

    const bids = await prisma.bid.findMany({
      where: {
        OR: sneakerSizeConditions,
        status: "active",
        bidderId: { not: session.user.id! },
      },
      include: {
        sneaker: {
          select: { brand: true, model: true, colorway: true, imageUrl: true },
        },
        bidder: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(bids);
  }

  // Default: role=buyer — return user's placed bids
  const bids = await prisma.bid.findMany({
    where: { bidderId: session.user.id! },
    include: {
      sneaker: {
        select: { brand: true, model: true, colorway: true, imageUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(bids);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sneakerId, size, amountCents, expiresInDays = 30 } = body;

  // Validate required fields
  if (!sneakerId || !size || !amountCents) {
    return NextResponse.json(
      { error: "sneakerId, size, and amountCents are required" },
      { status: 400 }
    );
  }

  if (typeof amountCents !== "number" || amountCents <= 0) {
    return NextResponse.json(
      { error: "amountCents must be a positive number" },
      { status: 400 }
    );
  }

  // Verify sneaker exists
  const sneaker = await prisma.sneaker.findUnique({
    where: { id: sneakerId },
  });

  if (!sneaker) {
    return NextResponse.json({ error: "Sneaker not found" }, { status: 404 });
  }

  // Prevent bidding on your own items
  const ownItem = await prisma.vaultItem.findFirst({
    where: {
      ownerId: session.user.id!,
      sneakerId,
      size,
      status: { in: ["vaulted", "listed"] },
    },
  });

  if (ownItem) {
    return NextResponse.json(
      { error: "Cannot bid on a sneaker you own in the vault" },
      { status: 400 }
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const bid = await prisma.bid.create({
    data: {
      sneakerId,
      bidderId: session.user.id!,
      size,
      amountCents,
      status: "active",
      expiresAt,
    },
    include: {
      sneaker: {
        select: { brand: true, model: true, colorway: true, imageUrl: true },
      },
    },
  });

  // After bid creation, notify sellers
  try {
    const sellerItems = await prisma.vaultItem.findMany({
      where: {
        sneakerId,
        size,
        status: { in: ["vaulted", "listed"] },
        ownerId: { not: session.user.id! },
      },
      select: { ownerId: true },
      distinct: ["ownerId"],
    });

    if (sellerItems.length > 0) {
      await prisma.notification.createMany({
        data: sellerItems.map((item) => ({
          userId: item.ownerId,
          type: "bid_received",
          title: "New Offer Received",
          message: `Someone offered $${(amountCents / 100).toFixed(2)} for your ${sneaker.brand} ${sneaker.model} (Size ${size})`,
          link: "/vault",
        })),
      });
    }
  } catch {}

  return NextResponse.json(bid, { status: 201 });
}
