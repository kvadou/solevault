import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chipId: string }> }
) {
  const { chipId } = await params;

  const item = await prisma.vaultItem.findUnique({
    where: { nfcChipId: chipId },
    select: { id: true },
  });

  if (!item) {
    return NextResponse.json({ error: "NFC chip not found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${baseUrl}/certificate/${item.id}`);
}
