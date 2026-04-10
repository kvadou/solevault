import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drops = await prisma.drop.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      packTiers: {
        include: {
          _count: { select: { poolItems: true, rips: true } },
        },
      },
    },
    take: 1000,
  });

  return NextResponse.json(drops);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, theme, imageUrl, startsAt, endsAt, maxPurchasesPerUser } = await req.json();

  if (!name || !startsAt) {
    return NextResponse.json({ error: "Name and start time are required" }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const existing = await prisma.drop.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A drop with that name already exists" }, { status: 400 });
  }

  const drop = await prisma.drop.create({
    data: {
      name,
      slug,
      description: description || null,
      theme: theme || null,
      imageUrl: imageUrl || null,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      maxPurchasesPerUser: maxPurchasesPerUser || 1,
      status: new Date(startsAt) <= new Date() ? "live" : "upcoming",
    },
  });

  return NextResponse.json(drop, { status: 201 });
}
