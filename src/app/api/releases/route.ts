import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  const releases = await prisma.release.findMany({
    where: {
      releaseDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Include releases from past week
    },
    include: {
      sneaker: { select: { brand: true, model: true, imageUrl: true } },
      reminders: userId ? { where: { userId }, select: { id: true } } : false,
    },
    orderBy: { releaseDate: "asc" },
  });

  return NextResponse.json(
    releases.map((r) => ({
      ...r,
      isReminded: userId ? r.reminders.length > 0 : false,
      reminders: undefined,
    }))
  );
}
