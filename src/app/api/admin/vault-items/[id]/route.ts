import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

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
