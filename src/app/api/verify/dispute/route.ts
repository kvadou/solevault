import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { certificateId, reason } = body as {
    certificateId: string;
    reason: string;
  };

  if (!certificateId || !reason) {
    return NextResponse.json(
      { error: "certificateId and reason are required" },
      { status: 400 }
    );
  }

  // Find certificate and verify ownership
  const certificate = await prisma.authenticationCertificate.findUnique({
    where: { id: certificateId },
    include: {
      vaultItem: {
        select: { ownerId: true },
      },
    },
  });

  if (!certificate) {
    return NextResponse.json(
      { error: "Certificate not found" },
      { status: 404 }
    );
  }

  if (certificate.vaultItem.ownerId !== userId) {
    return NextResponse.json(
      { error: "You can only dispute your own certificates" },
      { status: 403 }
    );
  }

  if (certificate.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed verifications can be disputed" },
      { status: 400 }
    );
  }

  const existingResultData =
    (certificate.resultData as Record<string, unknown>) || {};

  const updatedResultData = {
    ...existingResultData,
    disputeReason: reason,
    disputedBy: userId,
    disputedAt: new Date().toISOString(),
  };

  const updated = await prisma.authenticationCertificate.update({
    where: { id: certificateId },
    data: {
      status: "disputed",
      resultData: updatedResultData as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ certificate: updated });
}
