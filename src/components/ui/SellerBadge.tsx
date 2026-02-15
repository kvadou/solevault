"use client";

import { SELLER_LEVELS, type SellerLevel } from "@/lib/seller-levels";

const BADGE_COLORS: Record<SellerLevel, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-gray-200 text-gray-700",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-purple-100 text-purple-800",
};

export function SellerBadge({ level }: { level: SellerLevel }) {
  const config = SELLER_LEVELS[level];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[level]}`}
    >
      {config.label}
    </span>
  );
}
