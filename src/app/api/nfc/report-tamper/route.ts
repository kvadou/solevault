import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tagUid } = body as { tagUid: string };

    if (!tagUid) {
      return NextResponse.json({ error: "tagUid is required" }, { status: 400 });
    }

    const nfcTag = await prisma.nfcTag.findUnique({
      where: { tagUid },
    });

    if (!nfcTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (nfcTag.status === "deactivated") {
      return NextResponse.json({ message: "Tag already deactivated" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.nfcTag.update({
        where: { tagUid },
        data: { status: "deactivated" },
      });

      if (nfcTag.vaultItemId) {
        await tx.vaultItem.update({
          where: { id: nfcTag.vaultItemId },
          data: { nfcChipId: null },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Tag deactivated due to tamper detection",
    });
  } catch {
    return NextResponse.json({ error: "Failed to process tamper report" }, { status: 500 });
  }
}
