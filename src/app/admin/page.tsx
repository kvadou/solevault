"use client";

import { useState, useEffect } from "react";
import { Users, Package, Tag, DollarSign, Inbox, ShoppingCart, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Stats {
  totalUsers: number;
  totalVaultItems: number;
  activeListings: number;
  completedOrders: number;
  totalRevenueCents: number;
  pendingSubmissions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
    { label: "Vaulted Items", value: stats.totalVaultItems, icon: Package, color: "text-green-500" },
    { label: "Active Listings", value: stats.activeListings, icon: Tag, color: "text-purple-500" },
    { label: "Completed Orders", value: stats.completedOrders, icon: ShoppingCart, color: "text-orange-500" },
    { label: "Platform Revenue", value: formatPrice(stats.totalRevenueCents), icon: DollarSign, color: "text-emerald-500" },
    { label: "Pending Submissions", value: stats.pendingSubmissions, icon: Inbox, color: "text-yellow-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-[var(--border)] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">{card.label}</span>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold mt-2">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
