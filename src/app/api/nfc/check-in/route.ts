import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tagUid, condition, notes } = body as {
      tagUid: string;
      condition: string;
      notes?: string;
    };

    if (!tagUid || !condition) {
      return NextResponse.json({ error: "tagUid and condition are required" }, { status: 400 });
    }

    const nfcTag = await prisma.nfcTag.findUnique({
      where: { tagUid },
      include: { vaultItem: true },
    });

    if (!nfcTag || !nfcTag.vaultItem) {
      return NextResponse.json({ error: "Tag not found or not linked" }, { status: 404 });
    }

    if (nfcTag.status === "deactivated") {
      return NextResponse.json({ error: "This tag has been deactivated" }, { status: 410 });
    }

    if (nfcTag.vaultItem.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You are not the current owner of this item" },
        { status: 403 }
      );
    }

    const conditionReport = await prisma.conditionReport.create({
      data: {
        vaultItemId: nfcTag.vaultItemId!,
        reporterId: session.user.id,
        condition,
        notes: notes || null,
        photoUrls: [],
        context: "check_in",
      },
    });

    return NextResponse.json({
      success: true,
      conditionReport,
      message: "Check-in complete. Condition report recorded.",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
