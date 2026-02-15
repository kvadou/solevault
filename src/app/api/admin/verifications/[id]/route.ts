import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, notes } = body as { action: string; notes?: string };

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'approve' or 'reject'." },
      { status: 400 }
    );
  }

  const certificate = await prisma.authenticationCertificate.findUnique({
    where: { id },
  });

  if (!certificate) {
    return NextResponse.json(
      { error: "Certificate not found" },
      { status: 404 }
    );
  }

  const existingResultData =
    (certificate.resultData as Record<string, unknown>) || {};

  const newStatus = action === "approve" ? "verified" : "failed";
  const newScore =
    action === "approve"
      ? certificate.confidenceScore ?? 95
      : certificate.confidenceScore ?? 0;

  const updatedResultData = {
    ...existingResultData,
    adminReview: {
      action,
      reviewedBy: (session.user as { id?: string })?.id,
      reviewedAt: new Date().toISOString(),
      notes: notes || null,
    },
  };

  const updated = await prisma.authenticationCertificate.update({
    where: { id },
    data: {
      status: newStatus,
      confidenceScore: newScore,
      verifiedAt: action === "approve" ? new Date() : certificate.verifiedAt,
      resultData: updatedResultData as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ certificate: updated });
}
