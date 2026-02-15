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

  const drop = await prisma.drop.findUnique({
    where: { id },
    include: {
      packTiers: {
        include: {
          poolItems: {
            include: { vaultItem: { include: { sneaker: true } } },
            orderBy: { oddsWeight: "desc" },
          },
          _count: { select: { rips: true, poolItems: { where: { status: "available" } } } },
        },
      },
    },
  });

  if (!drop) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }

  return NextResponse.json(drop);
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

  const allowedFields = ["name", "description", "theme", "imageUrl", "startsAt", "endsAt", "status", "maxPurchasesPerUser"];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "startsAt" || field === "endsAt") {
        data[field] = body[field] ? new Date(body[field]) : null;
      } else {
        data[field] = body[field];
      }
    }
  }

  // Link/unlink pack tiers
  if (body.addTierIds && Array.isArray(body.addTierIds)) {
    await prisma.packTier.updateMany({
      where: { id: { in: body.addTierIds } },
      data: { dropId: id },
    });
  }
  if (body.removeTierIds && Array.isArray(body.removeTierIds)) {
    await prisma.packTier.updateMany({
      where: { id: { in: body.removeTierIds } },
      data: { dropId: null },
    });
  }

  const drop = await prisma.drop.update({
    where: { id },
    data,
    include: { packTiers: true },
  });

  return NextResponse.json(drop);
}
