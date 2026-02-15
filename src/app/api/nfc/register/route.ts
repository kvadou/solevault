import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TAG_UID_PATTERN = /^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){3,9}$/;
const PLAIN_HEX_PATTERN = /^[0-9a-fA-F]{8,20}$/;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { tagUid, vaultItemId } = body as { tagUid: string; vaultItemId: string };

    if (!tagUid || !vaultItemId) {
      return NextResponse.json({ error: "tagUid and vaultItemId are required" }, { status: 400 });
    }

    // Validate tagUid format (colon-separated hex bytes or plain hex string)
    if (!TAG_UID_PATTERN.test(tagUid) && !PLAIN_HEX_PATTERN.test(tagUid)) {
      return NextResponse.json({ error: "Invalid tag UID format" }, { status: 400 });
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

    // Register the NFC tag within a transaction to prevent race conditions
    const nfcTag = await prisma.$transaction(async (tx) => {
      const existingTag = await tx.nfcTag.findUnique({ where: { tagUid } });

      if (existingTag && existingTag.status === "active") {
        throw new Error("CONFLICT");
      }

      const tag = existingTag
        ? await tx.nfcTag.update({
            where: { tagUid },
            data: {
              vaultItemId,
              status: "active",
              assignedAt: new Date(),
            },
          })
        : await tx.nfcTag.create({
            data: {
              tagUid,
              vaultItemId,
              status: "active",
              assignedAt: new Date(),
            },
          });

      // Also update the VaultItem's nfcChipId for backwards compatibility
      await tx.vaultItem.update({
        where: { id: vaultItemId },
        data: { nfcChipId: tagUid },
      });

      return tag;
    });

    return NextResponse.json(nfcTag, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return NextResponse.json({ error: "This tag is already registered to an item" }, { status: 409 });
    }
    console.error("NFC register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
