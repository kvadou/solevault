import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const tier = await prisma.packTier.findUnique({
    where: { id },
    include: {
      poolItems: {
        include: {
          vaultItem: {
            include: { sneaker: true },
          },
        },
        orderBy: { oddsWeight: "desc" },
      },
      _count: {
        select: { rips: true },
      },
    },
  });

  if (!tier) {
    return NextResponse.json({ error: "Pack tier not found" }, { status: 404 });
  }

  return NextResponse.json(tier);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowedFields = ["name", "priceCents", "description", "totalSupply", "imageUrl", "status"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  const tier = await prisma.packTier.update({
    where: { id },
    data,
  });

  return NextResponse.json(tier);
}
