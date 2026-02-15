import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all vault items that have no ownership records
  const items = await prisma.vaultItem.findMany({
    where: {
      ownershipHistory: { none: {} },
    },
    select: { id: true, ownerId: true, createdAt: true },
  });

  console.log(`Found ${items.length} vault items without ownership records`);

  for (const item of items) {
    await prisma.ownershipRecord.create({
      data: {
        vaultItemId: item.id,
        fromUserId: null,
        toUserId: item.ownerId,
        eventType: "vault_submission",
        createdAt: item.createdAt,
      },
    });
  }

  console.log(`Created ${items.length} initial ownership records`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
