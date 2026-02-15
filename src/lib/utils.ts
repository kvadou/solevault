import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function calculateFees(priceCents: number, sellerFeePercent?: number) {
  const buyerFeeCents = Math.round(priceCents * 0.025); // buyer fee stays at 2.5%
  const sellerRate = sellerFeePercent !== undefined ? sellerFeePercent / 100 : 0.025;
  const sellerFeeCents = Math.round(priceCents * sellerRate);
  const platformRevenueCents = buyerFeeCents + sellerFeeCents;
  const totalBuyerPays = priceCents + buyerFeeCents;
  const sellerReceives = priceCents - sellerFeeCents;
  return { buyerFeeCents, sellerFeeCents, platformRevenueCents, totalBuyerPays, sellerReceives };
}

export function conditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    deadstock: "Deadstock (DS)",
    vnds: "VNDS",
    excellent: "Excellent",
    good: "Good",
  };
  return labels[condition] || condition;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    pending_auth: "bg-yellow-100 text-yellow-800",
    authenticated: "bg-blue-100 text-blue-800",
    vaulted: "bg-green-100 text-green-800",
    listed: "bg-purple-100 text-purple-800",
    sold: "bg-gray-100 text-gray-800",
    redeemed: "bg-orange-100 text-orange-800",
    active: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    passed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    label_created: "bg-gray-100 text-gray-800",
    shipped: "bg-blue-100 text-blue-800",
    received: "bg-indigo-100 text-indigo-800",
    authenticating: "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
    verified: "bg-green-100 text-green-800",
    needs_review: "bg-yellow-100 text-yellow-800",
    disputed: "bg-orange-100 text-orange-700",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}
