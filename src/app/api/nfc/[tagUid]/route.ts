import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tagUid: string }> }
) {
  const { tagUid } = await params;

  // First try lookup via NfcTag table
  const nfcTag = await prisma.nfcTag.findUnique({
    where: { tagUid },
    include: {
      vaultItem: {
        include: {
          certificates: {
            where: { status: "verified" },
            select: { id: true },
            orderBy: { verifiedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (nfcTag) {
    if (nfcTag.status === "deactivated") {
      return NextResponse.json(
        { error: "This tag has been deactivated — possible tamper detected", tagUid },
        { status: 410 }
      );
    }

    if (!nfcTag.vaultItem) {
      return NextResponse.json({ error: "Tag not linked to any item" }, { status: 404 });
    }

    const certificate = nfcTag.vaultItem.certificates[0];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solevault.com";
    if (certificate) {
      return NextResponse.redirect(`${baseUrl}/verify/${certificate.id}`);
    }
    return NextResponse.redirect(`${baseUrl}/certificate/${nfcTag.vaultItemId}`);
  }

  // Fallback: legacy chipId lookup via VaultItem.nfcChipId
  const item = await prisma.vaultItem.findUnique({
    where: { nfcChipId: tagUid },
    select: { id: true },
  });

  if (!item) {
    return NextResponse.json({ error: "Unknown tag" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solevault.com";
  return NextResponse.redirect(`${baseUrl}/certificate/${item.id}`);
}
