"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  ShieldCheck,
  Award,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
} from "lucide-react";

interface SellerProfile {
  id: string;
  name: string | null;
  sellerLevel: string;
  totalSales: number;
  trustScore: number | null;
  trustTier: string;
  trustTierLabel: string;
  trustTierDescription: string;
  totalVerified: number;
  disputeRate: number | null;
  authPassRate: number | null;
  memberSince: string;
  lastCalculated: string | null;
  recentCertificates: Array<{
    id: string;
    confidenceScore: number | null;
    verifiedAt: string | null;
    sneaker: { brand: string; model: string; imageUrl: string | null };
  }>;
}

function getTrustColor(score: number | null): string {
  if (score === null) return "text-[var(--muted-foreground)]";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function getTrustRingColor(score: number | null): string {
  if (score === null) return "border-[var(--border)]";
  if (score >= 80) return "border-green-500";
  if (score >= 60) return "border-blue-500";
  if (score >= 40) return "border-yellow-500";
  return "border-red-500";
}

function getTrustBgColor(score: number | null): string {
  if (score === null) return "bg-[var(--muted)]";
  if (score >= 80) return "bg-green-50";
  if (score >= 60) return "bg-blue-50";
  if (score >= 40) return "bg-yellow-50";
  return "bg-red-50";
}

function getTierBadgeClass(tier: string): string {
  switch (tier) {
    case "excellent":
      return "bg-green-100 text-green-700";
    case "good":
      return "bg-blue-100 text-blue-700";
    case "warning":
      return "bg-yellow-100 text-yellow-700";
    case "restricted":
      return "bg-orange-100 text-orange-700";
    case "suspended":
      return "bg-red-100 text-red-700";
    default:
      return "bg-[var(--muted)] text-[var(--muted-foreground)]";
  }
}

function getSellerLevelBadgeClass(level: string): string {
  switch (level) {
    case "gold":
      return "bg-yellow-100 text-yellow-800";
    case "silver":
      return "bg-gray-200 text-gray-700";
    case "platinum":
      return "bg-purple-100 text-purple-800";
    case "bronze":
    default:
      return "bg-amber-100 text-amber-800";
  }
}

export default function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/trust/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Seller not found");
          } else {
            setError("Failed to load seller profile");
          }
          return;
        }
        const data = await res.json();
        setProfile(data);
      } catch {
        setError("Failed to load seller profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle className="h-10 w-10 text-yellow-500" />
        <p className="text-[var(--muted-foreground)]">{error || "Something went wrong"}</p>
        <Link
          href="/marketplace"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          Back to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-[var(--muted)] flex items-center justify-center">
          <User className="h-8 w-8 text-[var(--muted-foreground)]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {profile.name || "Seller"}
          </h1>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getSellerLevelBadgeClass(
                profile.sellerLevel
              )}`}
            >
              {profile.sellerLevel}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getTierBadgeClass(
                profile.trustTier
              )}`}
            >
              <ShieldCheck className="h-3 w-3" />
              {profile.trustTierLabel}
            </span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {profile.trustTierDescription}
          </p>
        </div>
      </div>

      {/* Trust Score Gauge */}
      <div className="flex justify-center">
        <div
          className={`relative flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 ${getTrustRingColor(
            profile.trustScore
          )} ${getTrustBgColor(profile.trustScore)}`}
        >
          <span
            className={`text-3xl font-bold ${getTrustColor(profile.trustScore)}`}
          >
            {profile.trustScore !== null ? profile.trustScore : "--"}
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
            Trust Score
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-center">
          <Package className="h-5 w-5 mx-auto mb-1 text-[var(--muted-foreground)]" />
          <p className="text-lg font-bold">{profile.totalSales}</p>
          <p className="text-xs text-[var(--muted-foreground)]">Total Sales</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-[var(--muted-foreground)]" />
          <p className="text-lg font-bold">{profile.totalVerified}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Verified Items
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-center">
          <ShieldCheck className="h-5 w-5 mx-auto mb-1 text-[var(--muted-foreground)]" />
          <p className="text-lg font-bold">
            {profile.authPassRate !== null
              ? `${profile.authPassRate}%`
              : "N/A"}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Auth Pass Rate
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-center">
          <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-[var(--muted-foreground)]" />
          <p className="text-lg font-bold">
            {profile.disputeRate !== null
              ? `${profile.disputeRate}%`
              : "0%"}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Dispute Rate
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-[var(--muted-foreground)]" />
          <p className="text-lg font-bold">
            {new Date(profile.memberSince).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Member Since
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-center">
          <Award className="h-5 w-5 mx-auto mb-1 text-[var(--muted-foreground)]" />
          <p className="text-lg font-bold capitalize">{profile.sellerLevel}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Seller Level
          </p>
        </div>
      </div>

      {/* Recent Verified Items */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
          Recent Verified Items
        </h2>
        {profile.recentCertificates.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
            No verified items yet
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.recentCertificates.map((cert) => (
              <Link
                key={cert.id}
                href={`/verify/${cert.id}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden hover:border-[var(--accent)] transition-colors"
              >
                <div className="aspect-square relative bg-[var(--muted)]">
                  <Image
                    src={
                      cert.sneaker.imageUrl || "/placeholder-sneaker.svg"
                    }
                    alt={`${cert.sneaker.brand} ${cert.sneaker.model}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {cert.confidenceScore !== null && (
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                        <ShieldCheck className="h-3 w-3" />
                        {cert.confidenceScore}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
                    {cert.sneaker.brand}
                  </p>
                  <p className="text-sm font-medium truncate">
                    {cert.sneaker.model}
                  </p>
                  {cert.verifiedAt && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      Verified{" "}
                      {new Date(cert.verifiedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
