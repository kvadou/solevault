import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand");
  const search = searchParams.get("search");

  const sneakers = await prisma.sneaker.findMany({
    where: {
      ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { model: { contains: search, mode: "insensitive" } },
              { brand: { contains: search, mode: "insensitive" } },
              { colorway: { contains: search, mode: "insensitive" } },
              { styleCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { vaultItems: { where: { status: "listed" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(sneakers);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const sneaker = await prisma.sneaker.create({ data: body });
  return NextResponse.json(sneaker);
}
