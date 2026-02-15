import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tagUid, vaultItemId } = body as { tagUid: string; vaultItemId: string };

  if (!tagUid || !vaultItemId) {
    return NextResponse.json({ error: "tagUid and vaultItemId are required" }, { status: 400 });
  }

  // Verify the user owns the vault item
  const vaultItem = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
  });

  if (!vaultItem) {
    return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
  }

  if (vaultItem.ownerId !== session.user.id) {
    return NextResponse.json({ error: "You do not own this item" }, { status: 403 });
  }

  // Check if tag UID is already registered
  const existingTag = await prisma.nfcTag.findUnique({
    where: { tagUid },
  });

  if (existingTag && existingTag.status === "active") {
    return NextResponse.json({ error: "This tag is already registered to an item" }, { status: 409 });
  }

  // Create or reactivate the tag
  const nfcTag = existingTag
    ? await prisma.nfcTag.update({
        where: { tagUid },
        data: {
          vaultItemId,
          status: "active",
          assignedAt: new Date(),
        },
      })
    : await prisma.nfcTag.create({
        data: {
          tagUid,
          vaultItemId,
          status: "active",
          assignedAt: new Date(),
        },
      });

  // Also update the VaultItem's nfcChipId for backwards compatibility
  await prisma.vaultItem.update({
    where: { id: vaultItemId },
    data: { nfcChipId: tagUid },
  });

  return NextResponse.json(nfcTag, { status: 201 });
}
