"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Package,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toast";
import { formatPrice, conditionLabel } from "@/lib/utils";

interface PortfolioItem {
  id: string;
  size: string;
  condition: string;
  status: string;
  sneaker: {
    brand: string;
    model: string;
    colorway: string | null;
    imageUrl: string | null;
  };
  currentValueCents: number;
  costBasisCents: number;
  gainCents: number;
  gainPercent: number | null;
}

interface PortfolioHistoryPoint {
  date: string;
  valueCents: number;
}

interface PortfolioData {
  totalValueCents: number;
  totalCostCents: number;
  totalGainCents: number;
  itemCount: number;
  items: PortfolioItem[];
  history: PortfolioHistoryPoint[];
}

export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/vault/portfolio")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load");
          return r.json();
        })
        .then((data) => {
          setPortfolio(data);
          setLoading(false);
        })
        .catch(() => {
          toast("Failed to load portfolio", "error");
          setLoading(false);
        });
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!portfolio || portfolio.itemCount === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Track your vault value and investment returns
          </p>
        </div>
        <div className="text-center py-20 space-y-4">
          <Package className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
          <p className="text-lg font-medium">
            Your vault is empty — start vaulting sneakers to track your
            portfolio
          </p>
          <Link
            href="/vault/submit"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Vault Your First Pair
          </Link>
        </div>
      </div>
    );
  }

  const sortedItems = [...portfolio.items].sort(
    (a, b) => b.gainCents - a.gainCents
  );

  const totalGainIsPositive = portfolio.totalGainCents >= 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Track your vault value and investment returns
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Value */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              Total Value
            </span>
          </div>
          <p className="text-2xl font-bold">
            {formatPrice(portfolio.totalValueCents)}
          </p>
        </div>

        {/* Total Cost */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <DollarSign className="h-4 w-4 text-gray-600" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              Total Cost
            </span>
          </div>
          <p className="text-2xl font-bold">
            {formatPrice(portfolio.totalCostCents)}
          </p>
        </div>

        {/* Total Gain/Loss */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                totalGainIsPositive ? "bg-green-100" : "bg-red-100"
              }`}
            >
              {totalGainIsPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-600" />
              )}
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              Gain / Loss
            </span>
          </div>
          <p
            className={`text-2xl font-bold ${
              totalGainIsPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {totalGainIsPositive ? "+" : ""}
            {formatPrice(portfolio.totalGainCents)}
          </p>
        </div>

        {/* Items */}
        <div className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
              <Package className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              Items
            </span>
          </div>
          <p className="text-2xl font-bold">{portfolio.itemCount}</p>
        </div>
      </div>

      {/* Portfolio Value Chart */}
      {portfolio.history.length > 1 && (
        <div className="rounded-lg border border-[var(--border)] p-4 mb-8">
          <h2 className="text-lg font-semibold mb-4">Portfolio Value — Last 30 Days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={portfolio.history.map((p) => ({
                  date: new Date(p.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  }),
                  value: p.valueCents / 100,
                }))}
              >
                <defs>
                  <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(value: number | string | undefined) => [
                    `$${Number(value ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`,
                    "Portfolio Value",
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#portfolioFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedItems.map((item) => {
          const gainIsPositive = item.gainCents >= 0;

          return (
            <Link
              key={item.id}
              href="/vault"
              className="rounded-lg border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-colors"
            >
              {/* Image */}
              <div className="aspect-[4/3] relative bg-[var(--muted)]">
                <Image
                  src={item.sneaker.imageUrl || "/placeholder-sneaker.svg"}
                  alt={`${item.sneaker.brand} ${item.sneaker.model}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute top-2 left-2">
                  <Badge status={item.status} />
                </div>
              </div>

              {/* Details */}
              <div className="p-4 space-y-2">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
                  {item.sneaker.brand}
                </p>
                <p className="font-medium">{item.sneaker.model}</p>
                {item.sneaker.colorway && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {item.sneaker.colorway}
                  </p>
                )}

                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <span>Size {item.size}</span>
                  <span>&middot;</span>
                  <span>{conditionLabel(item.condition)}</span>
                </div>

                {/* Value Row */}
                <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Current Value
                    </span>
                    <span className="text-lg font-bold text-[var(--accent)]">
                      {formatPrice(item.currentValueCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Cost Basis
                    </span>
                    <span className="text-sm">
                      {formatPrice(item.costBasisCents)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Gain / Loss
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        gainIsPositive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {gainIsPositive ? "+" : ""}
                      {formatPrice(item.gainCents)}
                      {item.gainPercent !== null && (
                        <span className="ml-1 text-xs">
                          ({gainIsPositive ? "+" : ""}
                          {item.gainPercent}%)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
