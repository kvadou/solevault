import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tagUid: string }> }
) {
  const { tagUid } = await params;

  const nfcTag = await prisma.nfcTag.findUnique({
    where: { tagUid },
    include: {
      vaultItem: {
        include: {
          sneaker: {
            select: { brand: true, model: true, imageUrl: true },
          },
          owner: { select: { id: true } },
        },
      },
    },
  });

  if (!nfcTag || !nfcTag.vaultItem) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return NextResponse.json({
    tagUid: nfcTag.tagUid,
    status: nfcTag.status,
    vaultItem: {
      id: nfcTag.vaultItem.id,
      size: nfcTag.vaultItem.size,
      condition: nfcTag.vaultItem.condition,
      sneaker: nfcTag.vaultItem.sneaker,
      owner: nfcTag.vaultItem.owner,
    },
  });
}
