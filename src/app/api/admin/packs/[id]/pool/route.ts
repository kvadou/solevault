import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Add items to a pack tier's pool
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: packTierId } = await params;
  const { vaultItemIds, oddsWeight = 1 } = await req.json();

  if (!vaultItemIds || !Array.isArray(vaultItemIds) || vaultItemIds.length === 0) {
    return NextResponse.json({ error: "Vault item IDs required" }, { status: 400 });
  }

  // Verify all items are in "vaulted" status
  const items = await prisma.vaultItem.findMany({
    where: { id: { in: vaultItemIds }, status: "vaulted" },
  });

  if (items.length !== vaultItemIds.length) {
    return NextResponse.json(
      { error: `Only ${items.length} of ${vaultItemIds.length} items are eligible (must be vaulted status)` },
      { status: 400 }
    );
  }

  // Add to pool and update vault item status
  await prisma.$transaction([
    ...items.map((item) =>
      prisma.packPoolItem.create({
        data: {
          packTierId,
          vaultItemId: item.id,
          oddsWeight,
        },
      })
    ),
    ...items.map((item) =>
      prisma.vaultItem.update({
        where: { id: item.id },
        data: { status: "packed" },
      })
    ),
  ]);

  return NextResponse.json({ added: items.length });
}

// Remove item from pool
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: packTierId } = await params;
  const { poolItemId } = await req.json();

  const poolItem = await prisma.packPoolItem.findUnique({
    where: { id: poolItemId },
  });

  if (!poolItem || poolItem.packTierId !== packTierId || poolItem.status !== "available") {
    return NextResponse.json({ error: "Pool item not found or already claimed" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.packPoolItem.delete({ where: { id: poolItemId } }),
    prisma.vaultItem.update({
      where: { id: poolItem.vaultItemId },
      data: { status: "vaulted" },
    }),
  ]);

  return NextResponse.json({ removed: true });
}
