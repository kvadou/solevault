"use client";

import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { formatPrice, conditionLabel } from "@/lib/utils";
import { SellerBadge } from "@/components/ui/SellerBadge";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { VerificationPreview, useVerificationPreview } from "@/components/verify/VerificationPreview";
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
  const { showVerification, certData, loadingCert, openPreview, closePreview } = useVerificationPreview();

  function handleOpenVerification(certificateId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openPreview(certificateId);
  }

  return (
    <>
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
      </Link>
      <VerificationPreview
        open={showVerification}
        onClose={closePreview}
        certData={certData}
        loading={loadingCert}
      />
    </>
  );
}
