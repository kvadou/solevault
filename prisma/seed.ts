import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SNEAKERS = [
  { brand: "Jordan", model: "Air Jordan 1 Retro High OG", colorway: "Chicago", styleCode: "DZ5485-612", retailPriceCents: 18000, imageUrl: "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600&h=600&fit=crop", category: "basketball" },
  { brand: "Jordan", model: "Air Jordan 1 Retro High OG", colorway: "Bred", styleCode: "555088-001", retailPriceCents: 17000, imageUrl: "https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=600&h=600&fit=crop", category: "basketball" },
  { brand: "Jordan", model: "Air Jordan 4 Retro", colorway: "White Cement", styleCode: "840606-192", retailPriceCents: 22000, imageUrl: "https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=600&h=600&fit=crop", category: "basketball" },
  { brand: "Jordan", model: "Air Jordan 11 Retro", colorway: "Concord", styleCode: "378037-100", retailPriceCents: 22000, imageUrl: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&h=600&fit=crop", category: "basketball" },
  { brand: "Nike", model: "Air Force 1 Low", colorway: "White", styleCode: "CW2288-111", retailPriceCents: 11000, imageUrl: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "Nike", model: "Dunk Low", colorway: "Panda", styleCode: "DD1391-100", retailPriceCents: 11000, imageUrl: "https://images.unsplash.com/photo-1612902456551-404854679e67?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "Nike", model: "Dunk Low", colorway: "University Blue", styleCode: "DD1391-102", retailPriceCents: 11000, imageUrl: "https://images.unsplash.com/photo-1628253747716-0c4f5c90fdda?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "Nike", model: "Air Max 1", colorway: "OG Red", styleCode: "DQ3989-100", retailPriceCents: 15000, imageUrl: "https://images.unsplash.com/photo-1543508282-6319a3e2621f?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "Nike", model: "Air Max 90", colorway: "Infrared", styleCode: "CT1685-100", retailPriceCents: 13000, imageUrl: "https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "Adidas", model: "Yeezy Boost 350 V2", colorway: "Zebra", styleCode: "CP9654", retailPriceCents: 22000, imageUrl: "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "Adidas", model: "Yeezy Boost 350 V2", colorway: "Beluga", styleCode: "BB1826", retailPriceCents: 22000, imageUrl: "https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "New Balance", model: "550", colorway: "White Green", styleCode: "BB550WT1", retailPriceCents: 11000, imageUrl: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "New Balance", model: "2002R", colorway: "Protection Pack Rain Cloud", styleCode: "M2002RDA", retailPriceCents: 14000, imageUrl: "https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=600&h=600&fit=crop", category: "lifestyle" },
  { brand: "Nike", model: "SB Dunk Low", colorway: "Travis Scott", styleCode: "CT5053-001", retailPriceCents: 15000, imageUrl: "https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=600&h=600&fit=crop", category: "skateboarding" },
  { brand: "Jordan", model: "Air Jordan 3 Retro", colorway: "White Cement Reimagined", styleCode: "DN3707-100", retailPriceCents: 20000, imageUrl: "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600&h=600&fit=crop", category: "basketball" },
  { brand: "Asics", model: "Gel-Kayano 14", colorway: "Silver/White", styleCode: "1201A019-108", retailPriceCents: 15000, imageUrl: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=600&h=600&fit=crop", category: "running" },
];

const SIZES = ["8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"];
const CONDITIONS: Array<"deadstock" | "vnds" | "excellent" | "good"> = ["deadstock", "vnds", "excellent", "good"];

function randomPrice(retailCents: number): number {
  const multiplier = 0.8 + Math.random() * 1.5; // 80% to 230% of retail
  return Math.round(retailCents * multiplier);
}

async function main() {
  console.log("Seeding database...");

  // Create platform system account (for buyback inventory)
  await prisma.user.upsert({
    where: { email: "platform@solevault.io" },
    update: {},
    create: {
      email: "platform@solevault.io",
      name: "SoleVault Platform",
      role: "admin",
    },
  });
  console.log("Platform system account: platform@solevault.io");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@solevault.io" },
    update: {},
    create: {
      email: "admin@solevault.io",
      name: "SoleVault Admin",
      hashedPassword: adminPassword,
      role: "admin",
    },
  });
  console.log(`Admin user: admin@solevault.io / admin123`);

  // Create test user
  const userPassword = await bcrypt.hash("user123", 12);
  const testUser = await prisma.user.upsert({
    where: { email: "user@solevault.io" },
    update: {},
    create: {
      email: "user@solevault.io",
      name: "Test Collector",
      hashedPassword: userPassword,
      role: "user",
    },
  });
  console.log(`Test user: user@solevault.io / user123`);

  // Create sneaker catalog
  const createdSneakers = [];
  for (const s of SNEAKERS) {
    const sneaker = await prisma.sneaker.create({ data: s });
    createdSneakers.push(sneaker);
  }
  console.log(`Created ${createdSneakers.length} sneaker models`);

  // Create vaulted items and listings
  let listingCount = 0;
  for (const sneaker of createdSneakers) {
    // Create 1-3 vault items per sneaker
    const itemCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < itemCount; i++) {
      const size = SIZES[Math.floor(Math.random() * SIZES.length)];
      const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
      const priceCents = randomPrice(sneaker.retailPriceCents || 15000);
      const owner = Math.random() > 0.3 ? admin : testUser;

      const vaultItem = await prisma.vaultItem.create({
        data: {
          ownerId: owner.id,
          sneakerId: sneaker.id,
          size,
          condition,
          status: "listed",
          authenticationStatus: "passed",
          askingPriceCents: priceCents,
          originalVaulterId: owner.id,
          vaultedAt: new Date(),
          imageUrls: sneaker.imageUrl ? [sneaker.imageUrl] : [],
        },
      });

      // Create listing
      await prisma.listing.create({
        data: {
          vaultItemId: vaultItem.id,
          sellerId: owner.id,
          priceCents: priceCents,
          status: "active",
        },
      });
      listingCount++;
    }
  }
  console.log(`Created ${listingCount} vault items and listings`);

  // Seed some price history
  let historyCount = 0;
  for (const sneaker of createdSneakers) {
    for (let day = 30; day >= 0; day--) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      const priceCents = randomPrice(sneaker.retailPriceCents || 15000);

      await prisma.priceHistory.create({
        data: {
          sneakerId: sneaker.id,
          size: "10",
          priceCents,
          recordedAt: date,
        },
      });
      historyCount++;
    }
  }
  console.log(`Created ${historyCount} price history entries`);

  // Seed mystery packs
  // Create some extra vaulted items owned by admin (platform inventory) for pack pools
  const packItems = [];
  for (const sneaker of createdSneakers) {
    const size = SIZES[Math.floor(Math.random() * SIZES.length)];
    const condition = CONDITIONS[Math.floor(Math.random() * 2)]; // deadstock or vnds only
    const item = await prisma.vaultItem.create({
      data: {
        ownerId: admin.id,
        sneakerId: sneaker.id,
        size,
        condition,
        status: "vaulted",
        authenticationStatus: "passed",
        originalVaulterId: admin.id,
        vaultedAt: new Date(),
        imageUrls: sneaker.imageUrl ? [sneaker.imageUrl] : [],
      },
    });
    packItems.push({ item, retailCents: sneaker.retailPriceCents || 15000 });
  }

  // Create pack tiers
  const bronzeTier = await prisma.packTier.create({
    data: { name: "Bronze Pack", slug: "bronze-pack", priceCents: 2500, description: "Starter pack — great for first-timers", totalSupply: 50, status: "active" },
  });
  const silverTier = await prisma.packTier.create({
    data: { name: "Silver Pack", slug: "silver-pack", priceCents: 5000, description: "Mid-tier pulls with solid value", totalSupply: 30, status: "active" },
  });
  const goldTier = await prisma.packTier.create({
    data: { name: "Gold Pack", slug: "gold-pack", priceCents: 10000, description: "Premium pulls — high chance of profit", totalSupply: 20, status: "active" },
  });

  // Assign items to pools based on retail value
  for (const { item, retailCents } of packItems) {
    let tierId: string;
    let weight: number;

    if (retailCents >= 20000) {
      // High-value → gold tier, lower weight (rarer)
      tierId = goldTier.id;
      weight = 1;
    } else if (retailCents >= 14000) {
      // Mid-value → silver tier
      tierId = silverTier.id;
      weight = 2;
    } else {
      // Standard → bronze tier
      tierId = bronzeTier.id;
      weight = 3;
    }

    await prisma.packPoolItem.create({
      data: { packTierId: tierId, vaultItemId: item.id, oddsWeight: weight },
    });
    await prisma.vaultItem.update({
      where: { id: item.id },
      data: { status: "packed" },
    });
  }

  console.log(`Created 3 pack tiers with ${packItems.length} pool items`);

  // Seed curated drops
  const now = new Date();
  const liveDrop = await prisma.drop.create({
    data: {
      name: "Valentine's Day Heat",
      slug: "valentines-day-heat",
      description: "Limited edition drops for Valentine's Day. Premium sneakers, exclusive pulls.",
      theme: "valentines",
      startsAt: new Date(now.getTime() - 3600000), // started 1 hour ago
      endsAt: new Date(now.getTime() + 86400000 * 3), // ends in 3 days
      status: "live",
      maxPurchasesPerUser: 3,
    },
  });
  // Link bronze and silver tiers to this drop
  await prisma.packTier.update({ where: { id: bronzeTier.id }, data: { dropId: liveDrop.id } });
  await prisma.packTier.update({ where: { id: silverTier.id }, data: { dropId: liveDrop.id } });

  const upcomingDrop = await prisma.drop.create({
    data: {
      name: "Grail Season",
      slug: "grail-season",
      description: "The most coveted sneakers in the vault. High-value pulls only.",
      theme: "grail",
      startsAt: new Date(now.getTime() + 86400000 * 2), // starts in 2 days
      endsAt: new Date(now.getTime() + 86400000 * 5), // ends in 5 days
      status: "upcoming",
      maxPurchasesPerUser: 2,
    },
  });
  // Link gold tier to upcoming drop
  await prisma.packTier.update({ where: { id: goldTier.id }, data: { dropId: upcomingDrop.id } });

  console.log("Created 2 drops (1 live, 1 upcoming) with linked tiers");

  // Give test user some wallet balance to try packs
  await prisma.user.update({
    where: { id: testUser.id },
    data: { balanceCents: 50000 }, // $500
  });
  await prisma.walletTransaction.create({
    data: {
      userId: testUser.id,
      type: "deposit",
      amountCents: 50000,
      balanceAfterCents: 50000,
      description: "Welcome bonus (seed)",
    },
  });
  console.log("Gave test user $500 wallet balance");

  console.log("\nSeed complete!");
  console.log("-------------------------------");
  console.log("Admin login:  admin@solevault.io / admin123");
  console.log("User login:   user@solevault.io / user123 ($500 wallet)");
  console.log("-------------------------------");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
