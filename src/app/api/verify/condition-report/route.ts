import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_CONDITIONS = ["new", "like_new", "excellent", "good", "fair"];
const VALID_CONTEXTS = ["listing", "transfer", "check_in"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { vaultItemId, condition, notes, photoUrls } = body as {
    vaultItemId: string;
    condition: string;
    notes?: string;
    photoUrls?: string[];
    context?: string;
  };

  if (!vaultItemId || !condition) {
    return NextResponse.json(
      { error: "vaultItemId and condition are required" },
      { status: 400 }
    );
  }

  if (!VALID_CONDITIONS.includes(condition)) {
    return NextResponse.json(
      { error: `condition must be one of: ${VALID_CONDITIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const context = body.context || "listing";
  if (!VALID_CONTEXTS.includes(context)) {
    return NextResponse.json(
      { error: `context must be one of: ${VALID_CONTEXTS.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify the vault item exists
  const vaultItem = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
  });

  if (!vaultItem) {
    return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
  }

  const conditionReport = await prisma.conditionReport.create({
    data: {
      vaultItemId,
      reporterId: session.user.id,
      condition,
      notes: notes || null,
      photoUrls: photoUrls || [],
      context,
    },
  });

  return NextResponse.json(conditionReport, { status: 201 });
}
