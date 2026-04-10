import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const isAdmin = (session.user as { role?: string }).role === "admin" && searchParams.get("admin") === "true";
  const statusFilter = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (!isAdmin) {
    where.ownerId = session.user.id!;
  }
  if (statusFilter) {
    where.status = statusFilter;
  }

  const items = await prisma.vaultItem.findMany({
    where,
    include: {
      sneaker: true,
      listings: { where: { status: "active" } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sneakerId, size, condition, imageUrls, notes } = await req.json();

  if (!sneakerId || !size || !condition) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const submission = await prisma.vaultSubmission.create({
    data: { userId: session.user.id!, itemsExpected: 1 },
  });

  const item = await prisma.vaultItem.create({
    data: {
      ownerId: session.user.id!,
      sneakerId,
      size,
      condition,
      imageUrls: imageUrls || [],
      notes,
      status: "pending_auth",
      submissionId: submission.id,
    },
    include: { sneaker: true },
  });

  return NextResponse.json(item);
}
