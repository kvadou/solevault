import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const releases = await prisma.release.findMany({
    orderBy: { releaseDate: "desc" },
    include: {
      sneaker: { select: { id: true, brand: true, model: true, imageUrl: true } },
      _count: { select: { reminders: true } },
    },
    take: 1000,
  });

  return NextResponse.json(releases);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { releaseName, releaseDate, retailPriceCents, imageUrl, description, sneakerId, status } =
    await req.json();

  if (!releaseName || !releaseDate) {
    return NextResponse.json(
      { error: "Release name and date are required" },
      { status: 400 }
    );
  }

  const release = await prisma.release.create({
    data: {
      releaseName,
      releaseDate: new Date(releaseDate),
      retailPriceCents: retailPriceCents ? parseInt(retailPriceCents) : null,
      imageUrl: imageUrl || null,
      description: description || null,
      sneakerId: sneakerId || null,
      status: status || "upcoming",
    },
    include: {
      sneaker: { select: { id: true, brand: true, model: true, imageUrl: true } },
      _count: { select: { reminders: true } },
    },
  });

  return NextResponse.json(release, { status: 201 });
}
