"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice, conditionLabel } from "@/lib/utils";

interface ListingCardProps {
  listing: {
    id: string;
    priceCents: number;
    vaultItem: {
      id: string;
      size: string;
      condition: string;
      imageUrls: string[];
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
      </div>
      <div className="p-3 space-y-1">
        <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">{sneaker.brand}</p>
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
  );
}
