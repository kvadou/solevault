"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ArrowUpRight, ArrowDownLeft, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";

interface Order {
  id: string;
  salePriceCents: number;
  buyerFeeCents: number;
  sellerFeeCents: number;
  status: string;
  createdAt: string;
  buyerId: string;
  sellerId: string;
  buyer: { id: string; name: string | null };
  seller: { id: string; name: string | null };
  vaultItem: {
    size: string;
    sneaker: {
      brand: string;
      model: string;
      colorway: string | null;
      imageUrl: string | null;
    };
  };
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/orders").then((r) => r.json()).then((data) => { setOrders(data); setLoading(false); });
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <ShoppingBag className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
          <p className="text-lg font-medium">No orders yet</p>
          <p className="text-sm text-[var(--muted-foreground)]">Your purchases and sales will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isBuyer = order.buyerId === session?.user?.id;
            return (
              <div key={order.id} className="flex items-center gap-4 rounded-lg border border-[var(--border)] p-4">
                <div className="h-16 w-16 relative rounded-md bg-[var(--muted)] overflow-hidden flex-shrink-0">
                  <Image
                    src={order.vaultItem.sneaker.imageUrl || "/placeholder-sneaker.svg"}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isBuyer ? (
                      <ArrowDownLeft className="h-4 w-4 text-green-500" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-blue-500" />
                    )}
                    <span className="text-xs font-medium uppercase text-[var(--muted-foreground)]">
                      {isBuyer ? "Purchased" : "Sold"}
                    </span>
                    <Badge status={order.status} />
                  </div>
                  <p className="font-medium mt-1 truncate">
                    {order.vaultItem.sneaker.brand} {order.vaultItem.sneaker.model}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Size {order.vaultItem.size} &middot; {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold">{formatPrice(order.salePriceCents)}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Fee: {formatPrice(isBuyer ? order.buyerFeeCents : order.sellerFeeCents)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
