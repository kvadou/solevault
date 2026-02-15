"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Clock,
  Loader2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface WalletTransaction {
  id: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  description: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const typeLabels: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  purchase: "Purchase",
  sale: "Sale",
  buyback: "Buyback",
  revenue_share: "Revenue Share",
  refund: "Refund",
};

const typeIcons: Record<string, typeof ArrowDownLeft> = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  purchase: ArrowUpRight,
  sale: ArrowDownLeft,
  buyback: ArrowDownLeft,
  revenue_share: ArrowDownLeft,
  refund: ArrowDownLeft,
};

export default function WalletPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    }>
      <WalletContent />
    </Suspense>
  );
}

function WalletContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [balanceCents, setBalanceCents] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Modals
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchWallet = useCallback(async () => {
    const res = await fetch("/api/wallet");
    if (res.ok) {
      const data = await res.json();
      setBalanceCents(data.balanceCents);
    }
  }, []);

  const fetchTransactions = useCallback(async (p: number) => {
    const res = await fetch(`/api/wallet/transactions?page=${p}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      setTransactions(data.transactions);
      setPagination(data.pagination);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      Promise.all([fetchWallet(), fetchTransactions(1)]).then(() => setLoading(false));
    }
  }, [status, router, fetchWallet, fetchTransactions]);

  // Handle return from Stripe
  useEffect(() => {
    const deposit = searchParams.get("deposit");
    if (deposit === "success") {
      toast("Deposit successful! Your balance has been updated.", "success");
      fetchWallet();
      fetchTransactions(1);
    } else if (deposit === "cancelled") {
      toast("Deposit cancelled.", "error");
    }
  }, [searchParams, fetchWallet, fetchTransactions]);

  const handleDeposit = async () => {
    const cents = Math.round(parseFloat(depositAmount) * 100);
    if (isNaN(cents) || cents < 500 || cents > 50000) {
      toast("Enter an amount between $5 and $500", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast(data.error || "Failed to create deposit", "error");
      }
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const cents = Math.round(parseFloat(withdrawAmount) * 100);
    if (isNaN(cents) || cents < 1000) {
      toast("Minimum withdrawal is $10", "error");
      return;
    }

    if (cents + 150 > balanceCents) {
      toast("Insufficient balance (includes $1.50 fee)", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      const data = await res.json();
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else if (data.success) {
        toast(`Withdrawn ${formatPrice(data.withdrawnCents)}. Fee: $1.50`, "success");
        setBalanceCents(data.newBalanceCents);
        setWithdrawOpen(false);
        setWithdrawAmount("");
        fetchTransactions(page);
      } else {
        toast(data.error || "Withdrawal failed", "error");
      }
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchTransactions(newPage);
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Balance Card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-8 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="h-6 w-6 text-[var(--accent)]" />
          <h1 className="text-lg font-medium text-[var(--muted-foreground)]">Wallet Balance</h1>
        </div>
        <p className="text-5xl font-bold tracking-tight mb-6">{formatPrice(balanceCents)}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setDepositOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Add Funds
          </button>
          <button
            onClick={() => setWithdrawOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Withdraw
          </button>
        </div>
      </div>

      {/* Quick Deposit Amounts */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 mb-8">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)] mb-4">Quick Deposit</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[10, 25, 50, 100, 250].map((amount) => (
            <button
              key={amount}
              onClick={() => {
                setDepositAmount(amount.toString());
                setDepositOpen(true);
              }}
              className="rounded-lg border border-[var(--border)] py-3 text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Transaction History</h2>
          <button
            onClick={() => { fetchWallet(); fetchTransactions(page); }}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--muted-foreground)]">
            <Clock className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No transactions yet</p>
            <p className="text-xs mt-1">Add funds to get started</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--border)]">
              {transactions.map((tx) => {
                const Icon = typeIcons[tx.type] || ArrowDownLeft;
                const isCredit = tx.amountCents > 0;
                return (
                  <div key={tx.id} className="flex items-center gap-4 px-6 py-4">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        isCredit ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {typeLabels[tx.type] || tx.type} &middot;{" "}
                        {new Date(tx.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                        {isCredit ? "+" : ""}
                        {formatPrice(Math.abs(tx.amountCents))}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Bal: {formatPrice(tx.balanceAfterCents)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-[var(--muted)] transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= pagination.totalPages}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-[var(--muted)] transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Deposit Modal */}
      <Modal open={depositOpen} onClose={() => { setDepositOpen(false); setDepositAmount(""); }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
            <ArrowDownToLine className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Add Funds</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Deposit to your SoleVault wallet</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Amount (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">$</span>
            <input
              type="number"
              min="5"
              max="500"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-8 pr-4 py-3 text-lg font-medium focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-2">Min $5 &middot; Max $500 &middot; No deposit fees</p>
        </div>

        <div className="flex gap-3">
          {[25, 50, 100].map((amt) => (
            <button
              key={amt}
              onClick={() => setDepositAmount(amt.toString())}
              className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:border-[var(--accent)] transition-colors"
            >
              ${amt}
            </button>
          ))}
        </div>

        <button
          onClick={handleDeposit}
          disabled={submitting || !depositAmount}
          className="mt-6 w-full rounded-lg bg-[var(--accent)] py-3 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing...
            </span>
          ) : (
            `Deposit ${depositAmount ? formatPrice(Math.round(parseFloat(depositAmount) * 100) || 0) : "$0.00"}`
          )}
        </button>
      </Modal>

      {/* Withdraw Modal */}
      <Modal open={withdrawOpen} onClose={() => { setWithdrawOpen(false); setWithdrawAmount(""); }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <ArrowUpFromLine className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Withdraw Funds</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Transfer to your bank account</p>
          </div>
        </div>

        <div className="rounded-lg bg-[var(--muted)] p-4 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Available balance</span>
            <span className="font-medium">{formatPrice(balanceCents)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-[var(--muted-foreground)]">Withdrawal fee</span>
            <span className="font-medium">$1.50</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Withdrawal Amount (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">$</span>
            <input
              type="number"
              min="10"
              max={(balanceCents - 150) / 100}
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-8 pr-4 py-3 text-lg font-medium focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            Min $10 &middot; You&apos;ll receive{" "}
            {withdrawAmount
              ? formatPrice(Math.round(parseFloat(withdrawAmount) * 100) || 0)
              : "$0.00"}{" "}
            &middot; Total deducted:{" "}
            {withdrawAmount
              ? formatPrice((Math.round(parseFloat(withdrawAmount) * 100) || 0) + 150)
              : "$1.50"}
          </p>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={submitting || !withdrawAmount}
          className="w-full rounded-lg bg-[var(--primary)] py-3 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing...
            </span>
          ) : (
            `Withdraw ${withdrawAmount ? formatPrice(Math.round(parseFloat(withdrawAmount) * 100) || 0) : "$0.00"}`
          )}
        </button>
      </Modal>
    </div>
  );
}
