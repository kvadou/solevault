import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Auto-update drop statuses based on time
  const now = new Date();

  // Upcoming drops that should be live
  await prisma.drop.updateMany({
    where: { status: "upcoming", startsAt: { lte: now } },
    data: { status: "live" },
  });

  // Live drops that have ended by time
  await prisma.drop.updateMany({
    where: { status: "live", endsAt: { not: null, lte: now } },
    data: { status: "ended" },
  });

  const drops = await prisma.drop.findMany({
    orderBy: [
      { status: "asc" }, // live first, then upcoming, then ended/sold_out
      { startsAt: "asc" },
    ],
    include: {
      packTiers: {
        include: {
          _count: { select: { poolItems: { where: { status: "available" } } } },
        },
      },
    },
    take: 100,
  });

  return NextResponse.json(drops);
}
