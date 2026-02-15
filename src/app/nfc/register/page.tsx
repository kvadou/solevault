"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Smartphone, Check, AlertTriangle, QrCode } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface VaultItem {
  id: string;
  size: string;
  condition: string;
  nfcChipId: string | null;
  sneaker: {
    brand: string;
    model: string;
    imageUrl: string | null;
  };
}

export default function NfcRegisterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [tagUid, setTagUid] = useState("");
  const [scanning, setScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check Web NFC API support
    setNfcSupported("NDEFReader" in window);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/vault")
      .then((r) => r.json())
      .then((data) => {
        // Filter to items that are vaulted/listed and don't already have NFC
        const eligible = (data.items || data).filter(
          (item: VaultItem & { status: string }) =>
            ["vaulted", "listed", "authenticated"].includes(item.status) && !item.nfcChipId
        );
        setItems(eligible);
        setLoading(false);
      });
  }, [status, router]);

  async function startNfcScan() {
    if (!nfcSupported) return;
    setScanning(true);
    try {
      const ndef = new (window as unknown as { NDEFReader: new () => { scan: () => Promise<void>; onreading: ((event: { serialNumber: string }) => void) | null } }).NDEFReader();
      await ndef.scan();
      ndef.onreading = (event) => {
        setTagUid(event.serialNumber);
        setScanning(false);
        toast("NFC tag detected!", "success");
      };
    } catch {
      setScanning(false);
      toast("Failed to read NFC tag. Try manual entry.", "error");
    }
  }

  async function handleRegister() {
    if (!selectedItem || !tagUid.trim()) return;
    setRegistering(true);

    const res = await fetch("/api/nfc/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagUid: tagUid.trim(), vaultItemId: selectedItem }),
    });

    if (res.ok) {
      setSuccess(true);
      toast("NFC tag registered successfully!", "success");
    } else {
      const data = await res.json();
      toast(data.error || "Registration failed", "error");
    }
    setRegistering(false);
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Tag Registered!</h1>
        <p className="text-[var(--muted-foreground)]">
          Your NFC tag is now linked. Anyone can scan it to view the trust profile.
        </p>
        <button
          onClick={() => { setSuccess(false); setTagUid(""); setSelectedItem(null); }}
          className="rounded-md bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Register Another
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Register NFC Tag</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Link a physical NFC tag or QR sticker to your vault item
          </p>
        </div>

        {/* Step 1: Scan or enter tag UID */}
        <div className="rounded-lg border border-[var(--border)] p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-[var(--accent)]" />
            Step 1: Read Tag
          </h2>

          {nfcSupported ? (
            <div className="space-y-3">
              <button
                onClick={startNfcScan}
                disabled={scanning}
                className="w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Hold tag near phone...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4" />
                    Tap NFC Tag to Phone
                  </>
                )}
              </button>
              <div className="text-center text-xs text-[var(--muted-foreground)]">or enter manually</div>
            </div>
          ) : (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800">
                NFC not supported in this browser. Enter the tag UID manually.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">Tag UID</label>
            <input
              type="text"
              value={tagUid}
              onChange={(e) => setTagUid(e.target.value)}
              placeholder="e.g. 04:A3:12:8B:C5:90:80"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {tagUid && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Tag UID captured: <span className="font-mono">{tagUid}</span>
            </div>
          )}
        </div>

        {/* Step 2: Select vault item */}
        <div className="rounded-lg border border-[var(--border)] p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[var(--accent)]" />
            Step 2: Select Item
          </h2>

          {items.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No eligible items. Items must be vaulted and not already tagged.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 transition-colors text-left ${
                    selectedItem === item.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  <div className="relative h-12 w-12 rounded-md bg-[var(--muted)] overflow-hidden shrink-0">
                    {item.sneaker.imageUrl && (
                      <Image src={item.sneaker.imageUrl} alt="" fill className="object-cover" sizes="48px" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.sneaker.brand} {item.sneaker.model}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Size {item.size} · {item.condition}
                    </p>
                  </div>
                  {selectedItem === item.id && (
                    <Check className="h-5 w-5 text-[var(--accent)] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Register button */}
        <button
          onClick={handleRegister}
          disabled={!tagUid.trim() || !selectedItem || registering}
          className="w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {registering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            "Register Tag"
          )}
        </button>
      </div>
    </div>
  );
}
