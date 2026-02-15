import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function anonymizeName(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}.${parts[parts.length - 1][0]}.`;
    return `${name[0]}.`;
  }
  return `${email[0]}.***`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const { certificateId } = await params;

  const certificate = await prisma.authenticationCertificate.findUnique({
    where: { id: certificateId },
    include: {
      sneaker: true,
      vaultItem: {
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              sellerLevel: true,
              trustScore: true,
              trustTotalVerified: true,
            },
          },
          ownershipHistory: {
            orderBy: { createdAt: "asc" },
            include: {
              fromUser: { select: { name: true, email: true } },
              toUser: { select: { name: true, email: true } },
            },
          },
          conditionReports: {
            orderBy: { createdAt: "desc" },
            include: {
              reporter: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  if (certificate.status === "pending") {
    return NextResponse.json(
      { error: "Verification is still in progress" },
      { status: 202 }
    );
  }

  const { vaultItem, sneaker } = certificate;

  return NextResponse.json({
    certificate: {
      id: certificate.id,
      provider: certificate.provider,
      externalCertId: certificate.externalCertId,
      confidenceScore: certificate.confidenceScore,
      status: certificate.status,
      imageUrls: certificate.imageUrls,
      verifiedAt: certificate.verifiedAt,
      createdAt: certificate.createdAt,
    },
    sneaker: {
      brand: sneaker.brand,
      model: sneaker.model,
      colorway: sneaker.colorway,
      styleCode: sneaker.styleCode,
      imageUrl: sneaker.imageUrl,
    },
    item: {
      id: vaultItem.id,
      size: vaultItem.size,
      condition: vaultItem.condition,
      status: vaultItem.status,
    },
    sellerTrust: {
      sellerLevel: vaultItem.owner.sellerLevel,
      trustScore: vaultItem.owner.trustScore,
      totalVerified: vaultItem.owner.trustTotalVerified,
      anonymizedName: anonymizeName(vaultItem.owner.name, vaultItem.owner.email),
    },
    ownershipHistory: vaultItem.ownershipHistory.map((record) => ({
      id: record.id,
      eventType: record.eventType,
      from: record.fromUser
        ? anonymizeName(record.fromUser.name, record.fromUser.email)
        : null,
      to: anonymizeName(record.toUser.name, record.toUser.email),
      createdAt: record.createdAt,
    })),
    conditionReports: vaultItem.conditionReports.map((cr) => ({
      id: cr.id,
      condition: cr.condition,
      notes: cr.notes,
      photoUrls: cr.photoUrls,
      context: cr.context,
      reporter: anonymizeName(cr.reporter.name, cr.reporter.email),
      createdAt: cr.createdAt,
    })),
  });
}
