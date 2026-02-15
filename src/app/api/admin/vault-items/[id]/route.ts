import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const item = await prisma.vaultItem.findUnique({
    where: { id },
    include: {
      sneaker: true,
      owner: { select: { id: true, name: true, email: true } },
      submission: true,
      authReport: {
        include: {
          checkpoints: { orderBy: { sortOrder: "asc" } },
          photos: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Full authentication workflow
  if (body.action === "authenticate") {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the AuthenticationReport
      const authReport = await tx.authenticationReport.create({
        data: {
          vaultItemId: id,
          authenticatorId: (session.user as { id: string }).id,
          aiConfidenceScore: body.aiConfidenceScore ?? null,
          aiProvider: body.aiProvider ?? null,
          overallResult: body.overallResult,
          notes: body.notes ?? null,
        },
      });

      // 2. Create AuthCheckpoint entries
      if (body.checkpoints && Array.isArray(body.checkpoints)) {
        await Promise.all(
          body.checkpoints.map(
            (cp: { name: string; result: string; notes?: string }, index: number) =>
              tx.authCheckpoint.create({
                data: {
                  reportId: authReport.id,
                  name: cp.name,
                  result: cp.result,
                  notes: cp.notes ?? null,
                  sortOrder: index,
                },
              })
          )
        );
      }

      // 3. Create AuthPhoto entries
      if (body.photos && Array.isArray(body.photos)) {
        await Promise.all(
          body.photos.map(
            (photo: { angle: string; imageUrl: string }, index: number) =>
              tx.authPhoto.create({
                data: {
                  reportId: authReport.id,
                  angle: photo.angle,
                  imageUrl: photo.imageUrl,
                  sortOrder: index,
                },
              })
          )
        );
      }

      // 4. Update the VaultItem based on overallResult
      const vaultUpdate: Record<string, unknown> = {};

      if (body.overallResult === "passed") {
        vaultUpdate.status = "vaulted";
        vaultUpdate.authenticationStatus = "passed";
        vaultUpdate.vaultedAt = new Date();
      } else if (body.overallResult === "failed") {
        vaultUpdate.authenticationStatus = "failed";
      } else if (body.overallResult === "inconclusive") {
        vaultUpdate.authenticationStatus = "pending";
      }

      if (body.nfcChipId) vaultUpdate.nfcChipId = body.nfcChipId;
      if (body.vaultLocation) vaultUpdate.vaultLocation = body.vaultLocation;

      const updatedItem = await tx.vaultItem.update({
        where: { id },
        data: vaultUpdate,
        include: {
          sneaker: true,
          owner: { select: { id: true, name: true, email: true } },
          authReport: {
            include: {
              checkpoints: { orderBy: { sortOrder: "asc" } },
              photos: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      });

      // 5. Create OwnershipRecord if passed
      if (body.overallResult === "passed") {
        await tx.ownershipRecord.create({
          data: {
            vaultItemId: id,
            fromUserId: null,
            toUserId: updatedItem.ownerId,
            eventType: "vault_submission",
          },
        });
      }

      return updatedItem;
    });

    return NextResponse.json(result);
  }

  // Backwards-compatible simple update logic
  const update: Record<string, unknown> = {};

  if (body.status) update.status = body.status;
  if (body.authenticationStatus) update.authenticationStatus = body.authenticationStatus;
  if (body.vaultLocation) update.vaultLocation = body.vaultLocation;
  if (body.imageUrls) update.imageUrls = body.imageUrls;

  if (body.status === "vaulted") {
    update.vaultedAt = new Date();
    update.authenticationStatus = "passed";
  }

  const item = await prisma.vaultItem.update({
    where: { id },
    data: update,
    include: { sneaker: true, owner: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(item);
}
