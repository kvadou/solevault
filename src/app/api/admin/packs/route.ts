import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tiers = await prisma.packTier.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          poolItems: true,
          rips: true,
        },
      },
    },
    take: 1000,
  });

  return NextResponse.json(tiers);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, priceCents, description, totalSupply, imageUrl } = await req.json();

  if (!name || !priceCents || !totalSupply) {
    return NextResponse.json({ error: "Name, price, and total supply are required" }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const existing = await prisma.packTier.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A pack with that name already exists" }, { status: 400 });
  }

  const tier = await prisma.packTier.create({
    data: {
      name,
      slug,
      priceCents,
      description: description || null,
      totalSupply,
      imageUrl: imageUrl || null,
      status: "paused",
    },
  });

  return NextResponse.json(tier, { status: 201 });
}
