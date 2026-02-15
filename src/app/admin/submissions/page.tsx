"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, Eye, Shield } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface Submission {
  id: string;
  status: string;
  trackingNumber: string | null;
  itemsExpected: number;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  vaultItems: Array<{
    id: string;
    size: string;
    condition: string;
    status: string;
    authenticationStatus: string;
    sneaker: { brand: string; model: string; colorway: string | null };
  }>;
}

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [updating, setUpdating] = useState(false);

  async function fetchData() {
    const res = await fetch("/api/admin/submissions");
    setSubmissions(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function updateSubmissionStatus(id: string, status: string) {
    setUpdating(true);
    await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
    setUpdating(false);
  }

  async function approveVaultItem(itemId: string) {
    setUpdating(true);
    await fetch(`/api/admin/vault-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "vaulted", authenticationStatus: "passed" }),
    });
    await fetchData();
    setSelected(null);
    setUpdating(false);
  }

  async function rejectVaultItem(itemId: string) {
    setUpdating(true);
    await fetch(`/api/admin/vault-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending_auth", authenticationStatus: "failed" }),
    });
    await fetchData();
    setSelected(null);
    setUpdating(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Vault Submissions</h1>

      {submissions.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">No submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div key={sub.id} className="rounded-lg border border-[var(--border)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sub.user.name || sub.user.email}</span>
                    <Badge status={sub.status} />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {sub.itemsExpected} item(s) &middot; {new Date(sub.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelected(sub)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-[var(--muted)] transition-colors flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Review
                  </button>
                  {sub.status === "label_created" && (
                    <button
                      onClick={() => updateSubmissionStatus(sub.id, "received")}
                      disabled={updating}
                      className="rounded-md bg-blue-500 px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Mark Received
                    </button>
                  )}
                  {sub.status === "received" && (
                    <button
                      onClick={() => updateSubmissionStatus(sub.id, "authenticating")}
                      disabled={updating}
                      className="rounded-md bg-yellow-500 px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Start Auth
                    </button>
                  )}
                </div>
              </div>

              {/* Items in submission */}
              <div className="mt-3 space-y-2">
                {sub.vaultItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded bg-[var(--muted)] px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{item.sneaker.brand} {item.sneaker.model}</span>
                      <span className="text-[var(--muted-foreground)]">Size {item.size}</span>
                      <Badge status={item.authenticationStatus} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review modal */}
      <Modal open={!!selected} onClose={() => { if (!updating) setSelected(null); }} title="Review Submission" className="max-w-lg">
        {selected && (
          <div className="space-y-4">
            <div className="text-sm space-y-2">
              <p><strong>User:</strong> {selected.user.name} ({selected.user.email})</p>
              <p><strong>Status:</strong> <Badge status={selected.status} /></p>
              <p><strong>Submitted:</strong> {new Date(selected.createdAt).toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Items</h3>
              {selected.vaultItems.map((item) => (
                <div key={item.id} className="rounded border border-[var(--border)] p-3 space-y-2">
                  <p className="font-medium text-sm">{item.sneaker.brand} {item.sneaker.model}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Size {item.size} &middot; {item.condition}</p>
                  <div className="flex items-center gap-2">
                    <Badge status={item.authenticationStatus} />
                    <Badge status={item.status} />
                  </div>
                  {item.authenticationStatus === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Link
                        href={`/admin/authenticate/${item.id}`}
                        className="flex items-center gap-1 rounded bg-[var(--accent)] px-3 py-1 text-xs text-white hover:opacity-90"
                      >
                        <Shield className="h-3 w-3" /> Full Authentication
                      </Link>
                      <button
                        onClick={() => approveVaultItem(item.id)}
                        disabled={updating}
                        className="flex items-center gap-1 rounded bg-green-500 px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <CheckCircle className="h-3 w-3" /> Approve & Vault
                      </button>
                      <button
                        onClick={() => rejectVaultItem(item.id)}
                        disabled={updating}
                        className="flex items-center gap-1 rounded bg-red-500 px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
