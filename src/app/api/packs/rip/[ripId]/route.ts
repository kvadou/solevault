import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createOwnershipRecord } from "@/lib/ownership";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ripId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ripId } = await params;

  const rip = await prisma.packRip.findUnique({
    where: { id: ripId },
    include: {
      packTier: true,
      packPoolItem: {
        include: {
          vaultItem: {
            include: { sneaker: true },
          },
        },
      },
    },
  });

  if (!rip || rip.userId !== session.user.id) {
    return NextResponse.json({ error: "Rip not found" }, { status: 404 });
  }

  return NextResponse.json(rip);
}

// POST to reveal (transition from pending to revealed)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ ripId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ripId } = await params;

  const rip = await prisma.packRip.findUnique({
    where: { id: ripId },
    include: {
      packPoolItem: true,
    },
  });

  if (!rip || rip.userId !== session.user.id) {
    return NextResponse.json({ error: "Rip not found" }, { status: 404 });
  }

  if (rip.status !== "pending") {
    return NextResponse.json({ error: "Already revealed" }, { status: 400 });
  }

  // Capture previous owner before transfer
  const previousOwner = await prisma.vaultItem.findUnique({
    where: { id: rip.packPoolItem!.vaultItemId },
    select: { ownerId: true },
  });

  // Reveal: update rip status and transfer vault item ownership
  await prisma.$transaction([
    prisma.packRip.update({
      where: { id: ripId },
      data: { status: "revealed", revealedAt: new Date() },
    }),
    prisma.vaultItem.update({
      where: { id: rip.packPoolItem!.vaultItemId },
      data: { ownerId: session.user.id!, status: "vaulted" },
    }),
  ]);

  // Record ownership transfer
  await createOwnershipRecord({
    vaultItemId: rip.packPoolItem!.vaultItemId,
    fromUserId: previousOwner?.ownerId ?? null,
    toUserId: session.user.id!,
    eventType: "pack_reveal",
    packRipId: rip.id,
  });

  return NextResponse.json({ success: true });
}
