import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand");
  const size = searchParams.get("size");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") || "newest";

  const where: Record<string, unknown> = { status: "active" };

  if (brand) {
    where.vaultItem = { ...((where.vaultItem as Record<string, unknown>) || {}), sneaker: { brand: { equals: brand, mode: "insensitive" } } };
  }
  if (size) {
    where.vaultItem = { ...((where.vaultItem as Record<string, unknown>) || {}), size };
  }
  if (minPrice || maxPrice) {
    where.priceCents = {
      ...(minPrice ? { gte: parseInt(minPrice) * 100 } : {}),
      ...(maxPrice ? { lte: parseInt(maxPrice) * 100 } : {}),
    };
  }
  if (search) {
    where.vaultItem = {
      ...((where.vaultItem as Record<string, unknown>) || {}),
      sneaker: {
        OR: [
          { model: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
          { colorway: { contains: search, mode: "insensitive" } },
        ],
      },
    };
  }

  const orderBy = sort === "price_asc" ? { priceCents: "asc" as const }
    : sort === "price_desc" ? { priceCents: "desc" as const }
    : { createdAt: "desc" as const };

  const listings = await prisma.listing.findMany({
    where,
    include: {
      vaultItem: {
        include: {
          sneaker: true,
          owner: { select: { id: true, name: true, sellerLevel: true } },
        },
      },
    },
    orderBy,
    take: 50,
  });

  return NextResponse.json(listings);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultItemId, priceCents } = await req.json();

  const item = await prisma.vaultItem.findUnique({ where: { id: vaultItemId } });
  if (!item || item.ownerId !== session.user.id || item.status !== "vaulted") {
    return NextResponse.json({ error: "Item not available for listing" }, { status: 400 });
  }

  const [listing] = await prisma.$transaction([
    prisma.listing.create({
      data: { vaultItemId, sellerId: session.user.id!, priceCents },
    }),
    prisma.vaultItem.update({
      where: { id: vaultItemId },
      data: { status: "listed", askingPriceCents: priceCents },
    }),
  ]);

  // Fire-and-forget: check for watchlist price alerts
  try {
    const vaultItem = await prisma.vaultItem.findUnique({
      where: { id: vaultItemId },
      select: { sneakerId: true },
    });

    if (vaultItem) {
      const watchlistMatches = await prisma.watchlist.findMany({
        where: {
          sneakerId: vaultItem.sneakerId,
          targetPriceCents: { not: null, gte: priceCents },
          userId: { not: session.user.id },
        },
        include: { sneaker: { select: { brand: true, model: true } } },
      });

      if (watchlistMatches.length > 0) {
        await prisma.notification.createMany({
          data: watchlistMatches.map((w) => ({
            userId: w.userId,
            type: "price_alert",
            title: "Price Alert!",
            message: `${w.sneaker.brand} ${w.sneaker.model} is now listed at $${(priceCents / 100).toFixed(2)} — at or below your target of $${((w.targetPriceCents as number) / 100).toFixed(2)}`,
            link: `/sneakers/${vaultItem.sneakerId}`,
          })),
        });
      }
    }
  } catch {
    // Notification failures should not break listing creation
  }

  return NextResponse.json(listing);
}
