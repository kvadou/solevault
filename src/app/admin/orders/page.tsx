"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";

interface Order {
  id: string;
  salePriceCents: number;
  buyerFeeCents: number;
  sellerFeeCents: number;
  platformRevenueCents: number;
  status: string;
  createdAt: string;
  buyer: { name: string | null; email: string };
  seller: { name: string | null; email: string };
  vaultItem: {
    size: string;
    sneaker: { brand: string; model: string };
  };
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reuse the orders endpoint but admin sees all
    fetch("/api/orders").then((r) => r.json()).then((data) => {
      setOrders(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">All Orders</h1>

      {orders.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-2 font-medium text-[var(--muted-foreground)]">Date</th>
                <th className="text-left py-3 px-2 font-medium text-[var(--muted-foreground)]">Item</th>
                <th className="text-left py-3 px-2 font-medium text-[var(--muted-foreground)]">Buyer</th>
                <th className="text-left py-3 px-2 font-medium text-[var(--muted-foreground)]">Seller</th>
                <th className="text-right py-3 px-2 font-medium text-[var(--muted-foreground)]">Sale</th>
                <th className="text-right py-3 px-2 font-medium text-[var(--muted-foreground)]">Revenue</th>
                <th className="text-center py-3 px-2 font-medium text-[var(--muted-foreground)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50">
                  <td className="py-3 px-2 text-[var(--muted-foreground)]">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-2">
                    {order.vaultItem.sneaker.brand} {order.vaultItem.sneaker.model}
                    <span className="text-[var(--muted-foreground)]"> sz {order.vaultItem.size}</span>
                  </td>
                  <td className="py-3 px-2">{order.buyer.name || order.buyer.email}</td>
                  <td className="py-3 px-2">{order.seller.name || order.seller.email}</td>
                  <td className="py-3 px-2 text-right font-medium">{formatPrice(order.salePriceCents)}</td>
                  <td className="py-3 px-2 text-right font-medium text-[var(--accent)]">{formatPrice(order.platformRevenueCents)}</td>
                  <td className="py-3 px-2 text-center"><Badge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
