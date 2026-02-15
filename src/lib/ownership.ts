import { prisma } from "./prisma";

export async function createOwnershipRecord(params: {
  vaultItemId: string;
  fromUserId: string | null;
  toUserId: string;
  eventType: "vault_submission" | "marketplace_sale" | "pack_reveal" | "redemption";
  orderId?: string;
  packRipId?: string;
}) {
  return prisma.ownershipRecord.create({
    data: {
      vaultItemId: params.vaultItemId,
      fromUserId: params.fromUserId,
      toUserId: params.toUserId,
      eventType: params.eventType,
      orderId: params.orderId ?? null,
      packRipId: params.packRipId ?? null,
    },
  });
}
