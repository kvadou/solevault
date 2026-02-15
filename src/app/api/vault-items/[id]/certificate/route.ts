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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const item = await prisma.vaultItem.findUnique({
    where: { id },
    include: {
      sneaker: true,
      owner: { select: { id: true, name: true, email: true } },
      authReport: {
        include: {
          checkpoints: { orderBy: { sortOrder: "asc" } },
          photos: { orderBy: { sortOrder: "asc" } },
          authenticator: { select: { id: true, name: true } },
        },
      },
      ownershipHistory: {
        orderBy: { createdAt: "asc" },
        include: {
          fromUser: { select: { id: true, name: true, email: true } },
          toUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (!item.authReport) {
    return NextResponse.json({ error: "No authentication report available" }, { status: 404 });
  }

  // Anonymize ownership chain
  const ownershipChain = item.ownershipHistory.map((record) => ({
    id: record.id,
    eventType: record.eventType,
    from: record.fromUser ? anonymizeName(record.fromUser.name, record.fromUser.email) : null,
    to: anonymizeName(record.toUser.name, record.toUser.email),
    createdAt: record.createdAt,
  }));

  return NextResponse.json({
    item: {
      id: item.id,
      size: item.size,
      condition: item.condition,
      status: item.status,
      nfcChipId: item.nfcChipId,
      vaultLocation: item.vaultLocation,
      vaultedAt: item.vaultedAt,
      createdAt: item.createdAt,
    },
    sneaker: {
      brand: item.sneaker.brand,
      model: item.sneaker.model,
      colorway: item.sneaker.colorway,
      styleCode: item.sneaker.styleCode,
      imageUrl: item.sneaker.imageUrl,
    },
    report: {
      overallResult: item.authReport.overallResult,
      aiConfidenceScore: item.authReport.aiConfidenceScore,
      aiProvider: item.authReport.aiProvider,
      notes: item.authReport.notes,
      createdAt: item.authReport.createdAt,
      checkpoints: item.authReport.checkpoints.map((cp) => ({
        name: cp.name,
        result: cp.result,
        notes: cp.notes,
      })),
      photos: item.authReport.photos.map((p) => ({
        angle: p.angle,
        imageUrl: p.imageUrl,
      })),
    },
    currentOwner: anonymizeName(item.owner.name, item.owner.email),
    ownershipChain,
  });
}
