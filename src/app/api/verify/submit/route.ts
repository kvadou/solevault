import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitForVerification } from "@/lib/entrupy";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { vaultItemId, imageUrls } = body as {
    vaultItemId: string;
    imageUrls: string[];
  };

  if (!vaultItemId || !imageUrls?.length) {
    return NextResponse.json(
      { error: "vaultItemId and imageUrls are required" },
      { status: 400 }
    );
  }

  // Verify the user owns this vault item
  const vaultItem = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
    include: { sneaker: true },
  });

  if (!vaultItem) {
    return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
  }

  if (vaultItem.ownerId !== session.user.id) {
    return NextResponse.json({ error: "You do not own this item" }, { status: 403 });
  }

  // Check for existing pending/verified certificate
  const existing = await prisma.authenticationCertificate.findFirst({
    where: {
      vaultItemId,
      status: { in: ["pending", "verified"] },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This item already has an active verification", certificateId: existing.id },
      { status: 409 }
    );
  }

  // Create pending certificate
  const certificate = await prisma.authenticationCertificate.create({
    data: {
      vaultItemId,
      sneakerId: vaultItem.sneakerId,
      provider: "entrupy",
      status: "pending",
      imageUrls,
    },
  });

  // Fire-and-forget: process verification asynchronously
  processVerification(certificate.id, vaultItem.sneaker, imageUrls, session.user.id).catch(
    (err) => console.error("Verification processing failed:", err)
  );

  return NextResponse.json(
    { certificateId: certificate.id, status: "pending" },
    { status: 201 }
  );
}

async function processVerification(
  certificateId: string,
  sneaker: { brand: string; model: string; styleCode: string | null },
  imageUrls: string[],
  ownerId: string
) {
  try {
    const result = await submitForVerification({
      imageUrls,
      brand: sneaker.brand,
      model: sneaker.model,
      styleCode: sneaker.styleCode ?? undefined,
    });

    await prisma.authenticationCertificate.update({
      where: { id: certificateId },
      data: {
        externalCertId: result.externalCertId,
        confidenceScore: result.confidenceScore,
        status: result.status,
        resultData: result.resultData as Prisma.InputJsonValue,
        verifiedAt: result.status === "verified" ? new Date() : null,
      },
    });

    // Create notification for the owner
    const statusMessages: Record<string, { title: string; message: string }> = {
      verified: {
        title: "Item Verified!",
        message: `Your ${sneaker.brand} ${sneaker.model} has been verified authentic with ${result.confidenceScore}% confidence.`,
      },
      needs_review: {
        title: "Verification Needs Review",
        message: `Your ${sneaker.brand} ${sneaker.model} needs additional review. An admin will check it within 24 hours.`,
      },
      failed: {
        title: "Verification Failed",
        message: `Your ${sneaker.brand} ${sneaker.model} did not pass verification (score: ${result.confidenceScore}%). You can dispute this result.`,
      },
    };

    const msg = statusMessages[result.status];
    if (msg) {
      await prisma.notification.create({
        data: {
          userId: ownerId,
          type: "verification",
          title: msg.title,
          message: msg.message,
          link: `/verify/${certificateId}`,
        },
      });
    }
  } catch (err) {
    console.error("Entrupy verification error:", err);
    await prisma.authenticationCertificate.update({
      where: { id: certificateId },
      data: { status: "failed" },
    });
  }
}
