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
          owner: { select: { id: true, name: true } },
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

  return NextResponse.json(listing);
}
