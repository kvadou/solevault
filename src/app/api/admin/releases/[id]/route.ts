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

  const release = await prisma.release.findUnique({
    where: { id },
    include: {
      sneaker: { select: { id: true, brand: true, model: true, imageUrl: true } },
      _count: { select: { reminders: true } },
    },
  });

  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  return NextResponse.json(release);
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

  const allowedFields = [
    "releaseName",
    "releaseDate",
    "retailPriceCents",
    "imageUrl",
    "description",
    "sneakerId",
    "status",
  ];
  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "releaseDate") {
        data[field] = body[field] ? new Date(body[field]) : null;
      } else if (field === "retailPriceCents") {
        data[field] = body[field] ? parseInt(body[field]) : null;
      } else {
        data[field] = body[field] || null;
      }
    }
  }

  const release = await prisma.release.update({
    where: { id },
    data,
    include: {
      sneaker: { select: { id: true, brand: true, model: true, imageUrl: true } },
      _count: { select: { reminders: true } },
    },
  });

  return NextResponse.json(release);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const release = await prisma.release.findUnique({ where: { id } });
  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  await prisma.release.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
