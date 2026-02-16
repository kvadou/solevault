"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { formatPrice, conditionLabel, statusColor } from "@/lib/utils";
import { SellerBadge } from "@/components/ui/SellerBadge";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { SlideOver } from "@/components/ui/SlideOver";
import type { SellerLevel } from "@/lib/seller-levels";

interface ListingCardProps {
  listing: {
    id: string;
    priceCents: number;
    vaultItem: {
      id: string;
      size: string;
      condition: string;
      imageUrls: string[];
      certificates?: Array<{ id: string; confidenceScore: number | null }>;
      owner?: {
        id: string;
        name: string | null;
        sellerLevel?: string;
        trustScore?: number | null;
      };
      sneaker: {
        id: string;
        brand: string;
        model: string;
        colorway: string | null;
        imageUrl: string | null;
      };
    };
  };
}

export function ListingCard({ listing }: ListingCardProps) {
  const { vaultItem } = listing;
  const { sneaker } = vaultItem;
  const imageUrl = vaultItem.imageUrls[0] || sneaker.imageUrl || "/placeholder-sneaker.svg";
  const [showVerification, setShowVerification] = useState(false);
  const [certData, setCertData] = useState<Record<string, unknown> | null>(null);
  const [loadingCert, setLoadingCert] = useState(false);

  function handleOpenVerification(certificateId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShowVerification(true);
    setLoadingCert(true);
    setCertData(null);
    fetch(`/api/verify/certificate/${certificateId}`)
      .then((r) => r.json())
      .then((data) => setCertData(data))
      .catch(() => setCertData(null))
      .finally(() => setLoadingCert(false));
  }

  return (
    <Link
      href={`/sneakers/${sneaker.id}`}
      className="group block rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden hover:border-[var(--accent)] transition-colors"
    >
      <div className="aspect-square relative bg-[var(--muted)] overflow-hidden">
        <Image
          src={imageUrl}
          alt={`${sneaker.brand} ${sneaker.model}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-700">
            {conditionLabel(vaultItem.condition)}
          </span>
        </div>
        {vaultItem.certificates && vaultItem.certificates.length > 0 && (
          <div className="absolute top-2 left-2">
            <button
              onClick={(e) => handleOpenVerification(vaultItem.certificates![0].id, e)}
              className="inline-flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-green-600/90 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-3 w-3" />
              Verified
            </button>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">{sneaker.brand}</p>
          <div className="flex items-center gap-1">
            {vaultItem.owner?.trustScore != null && (
              <TrustBadge score={vaultItem.owner.trustScore} />
            )}
            {vaultItem.owner?.sellerLevel && (
              <SellerBadge level={vaultItem.owner.sellerLevel as SellerLevel} />
            )}
          </div>
        </div>
        <p className="text-sm font-medium truncate">{sneaker.model}</p>
        {sneaker.colorway && (
          <p className="text-xs text-[var(--muted-foreground)] truncate">{sneaker.colorway}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-bold">{formatPrice(listing.priceCents)}</span>
          <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded">
            Size {vaultItem.size}
          </span>
        </div>
      </div>
      <SlideOver
        open={showVerification}
        onClose={() => setShowVerification(false)}
        title="Verification Details"
      >
        {loadingCert ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : certData && "certificate" in certData ? (
          <div className="space-y-6">
            {/* Confidence score */}
            <div className="text-center">
              <p className="text-5xl font-bold">
                {String((certData.certificate as Record<string, unknown>).confidenceScore ?? "—")}
                <span className="text-lg font-normal text-[var(--muted-foreground)]">%</span>
              </p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Confidence Score</p>
            </div>

            {/* Status & date */}
            <div className="flex items-center justify-center gap-3">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(String((certData.certificate as Record<string, unknown>).status ?? ""))}`}>
                {String((certData.certificate as Record<string, unknown>).status ?? "")}
              </span>
              {typeof (certData.certificate as Record<string, unknown>).verifiedAt === "string" && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {new Date(String((certData.certificate as Record<string, unknown>).verifiedAt)).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Submitted photos */}
            {Array.isArray((certData.certificate as Record<string, unknown>).imageUrls) &&
              ((certData.certificate as Record<string, unknown>).imageUrls as string[]).length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Submitted Photos</h3>
                <div className="grid grid-cols-3 gap-2">
                  {((certData.certificate as Record<string, unknown>).imageUrls as string[]).map((url, i) => (
                    <div key={i} className="aspect-square relative rounded-md overflow-hidden bg-[var(--muted)]">
                      <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="120px" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View full trust profile link */}
            <Link
              href={`/verify/${(certData.certificate as Record<string, unknown>).id}`}
              className="block w-full text-center rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              View Full Trust Profile
            </Link>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
            Unable to load verification details.
          </p>
        )}
      </SlideOver>
    </Link>
  );
}
