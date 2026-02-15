export const SELLER_LEVELS = {
  bronze: { minSales: 0, feePercent: 5.0, label: "Bronze", color: "amber" },
  silver: { minSales: 10, feePercent: 4.0, label: "Silver", color: "gray" },
  gold: { minSales: 50, feePercent: 3.5, label: "Gold", color: "yellow" },
  platinum: { minSales: 200, feePercent: 3.0, label: "Platinum", color: "purple" },
} as const;

export type SellerLevel = keyof typeof SELLER_LEVELS;

export function getSellerLevel(totalSales: number): SellerLevel {
  if (totalSales >= 200) return "platinum";
  if (totalSales >= 50) return "gold";
  if (totalSales >= 10) return "silver";
  return "bronze";
}

export function getFeePercent(level: SellerLevel): number {
  return SELLER_LEVELS[level].feePercent;
}

export function getNextLevelInfo(level: SellerLevel, totalSales: number): { nextLevel: SellerLevel | null; salesNeeded: number } | null {
  const levels: SellerLevel[] = ["bronze", "silver", "gold", "platinum"];
  const currentIndex = levels.indexOf(level);
  if (currentIndex >= levels.length - 1) return null;
  const nextLevel = levels[currentIndex + 1];
  return {
    nextLevel,
    salesNeeded: SELLER_LEVELS[nextLevel].minSales - totalSales,
  };
}
