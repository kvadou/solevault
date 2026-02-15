import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const { certificateId } = await params;

  const certificate = await prisma.authenticationCertificate.findUnique({
    where: { id: certificateId },
    select: {
      id: true,
      status: true,
      confidenceScore: true,
      verifiedAt: true,
      provider: true,
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  return NextResponse.json(certificate);
}
