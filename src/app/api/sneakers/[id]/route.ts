import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sneaker = await prisma.sneaker.findUnique({
    where: { id },
    include: {
      vaultItems: {
        where: { status: "listed" },
        include: {
          listings: { where: { status: "active" }, select: { id: true, priceCents: true, createdAt: true } },
          owner: { select: { id: true, name: true } },
        },
      },
      priceHistory: {
        orderBy: { recordedAt: "desc" },
        take: 30,
      },
    },
  });

  if (!sneaker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(sneaker);
}
