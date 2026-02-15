"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone, QrCode, Shield, Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";

const TAGS = [
  {
    type: "qr" as const,
    name: "QR Sticker",
    priceCents: 200,
    icon: QrCode,
    description: "Printed QR code applied to box or shoe bag. Budget option for basic verification.",
    features: ["Links to trust profile", "Applied to shoe box", "Weather-resistant"],
  },
  {
    type: "nfc" as const,
    name: "Premium NFC Tag",
    priceCents: 800,
    icon: Smartphone,
    description: "Tamper-evident NFC sticker applied to shoe. Encrypted UID. Breaks if removed.",
    features: ["Tap to verify", "Tamper-evident", "Encrypted UID", "Inside tongue/insole"],
  },
];

export default function NfcPurchasePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<"qr" | "nfc">("nfc");
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);

  const selected = TAGS.find((t) => t.type === selectedType)!;

  async function handlePurchase() {
    if (!session) {
      router.push("/auth/signin");
      return;
    }
    setPurchasing(true);

    try {
      const res = await fetch("/api/nfc/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagType: selectedType, quantity }),
      });

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast(data.error || "Failed to create checkout", "error");
        setPurchasing(false);
      }
    } catch {
      toast("Something went wrong. Please try again.", "error");
      setPurchasing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Purchase Verification Tags</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Physical tags that link to your item&apos;s trust profile
        </p>
      </div>

      {/* Tag tier selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TAGS.map((tag) => {
          const Icon = tag.icon;
          return (
            <button
              key={tag.type}
              onClick={() => setSelectedType(tag.type)}
              className={`rounded-lg border p-6 text-left transition-colors ${
                selectedType === tag.type
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  tag.type === "nfc" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{tag.name}</p>
                  <p className="text-lg font-bold text-[var(--accent)]">
                    {formatPrice(tag.priceCents)}
                    <span className="text-xs font-normal text-[var(--muted-foreground)]"> each</span>
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">{tag.description}</p>
              <ul className="space-y-1">
                {tag.features.map((f) => (
                  <li key={f} className="text-xs text-[var(--muted-foreground)] flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-[var(--accent)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Quantity + checkout */}
      <div className="rounded-lg border border-[var(--border)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{selected.name}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{formatPrice(selected.priceCents)} each</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-lg font-bold w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(50, quantity + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold">{formatPrice(selected.priceCents * quantity)}</span>
        </div>

        <button
          onClick={handlePurchase}
          disabled={purchasing}
          className="w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {purchasing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to Stripe...
            </>
          ) : (
            `Purchase ${quantity} Tag${quantity !== 1 ? "s" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
