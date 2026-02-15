"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Calendar, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface ReleaseData {
  id: string;
  releaseName: string;
  releaseDate: string;
  retailPriceCents: number | null;
  imageUrl: string | null;
  description: string | null;
  status: string;
  isReminded: boolean;
  sneaker: {
    brand: string;
    model: string;
    imageUrl: string | null;
  } | null;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  let colorClasses = "";
  let label = status;

  switch (status) {
    case "upcoming":
      colorClasses = "bg-blue-100 text-blue-800";
      label = "Upcoming";
      break;
    case "released":
      colorClasses = "bg-green-100 text-green-800";
      label = "Released";
      break;
    case "sold_out":
      colorClasses = "bg-red-100 text-red-800";
      label = "Sold Out";
      break;
    default:
      colorClasses = "bg-gray-100 text-gray-800";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClasses}`}
    >
      {label}
    </span>
  );
}

export default function ReleasesPage() {
  const router = useRouter();
  const [releases, setReleases] = useState<ReleaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/releases")
      .then((res) => res.json())
      .then((data: ReleaseData[]) => {
        setReleases(data);
        const reminded = new Set<string>();
        data.forEach((r) => {
          if (r.isReminded) reminded.add(r.id);
        });
        setRemindedIds(reminded);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleReminder = useCallback(
    async (releaseId: string) => {
      if (togglingIds.has(releaseId)) return;

      setTogglingIds((prev) => new Set(prev).add(releaseId));

      try {
        const res = await fetch(`/api/releases/${releaseId}/remind`, {
          method: "POST",
        });

        if (res.status === 401) {
          router.push("/auth/signin");
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setRemindedIds((prev) => {
            const next = new Set(prev);
            if (data.reminded) {
              next.add(releaseId);
            } else {
              next.delete(releaseId);
            }
            return next;
          });
        }
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(releaseId);
          return next;
        });
      }
    },
    [togglingIds, router]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Release Calendar</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Upcoming sneaker drops
        </p>
      </div>

      {/* Releases Grid */}
      {releases.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-[var(--muted-foreground)] opacity-40" />
          <p className="text-lg text-[var(--muted-foreground)]">
            No upcoming releases
          </p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {releases.map((release) => {
            const imageUrl =
              release.imageUrl || release.sneaker?.imageUrl || null;
            const isReminded = remindedIds.has(release.id);
            const isToggling = togglingIds.has(release.id);

            return (
              <div
                key={release.id}
                className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--background)]"
              >
                {/* Image */}
                <div className="aspect-[4/3] bg-[var(--muted)] relative">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={release.releaseName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-[var(--muted-foreground)] opacity-30" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">
                        {release.releaseName}
                      </h3>
                      {release.sneaker && (
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {release.sneaker.brand} {release.sneaker.model}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={release.status} />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {formatDate(release.releaseDate)}
                      </p>
                      {release.retailPriceCents != null && (
                        <p className="text-sm font-semibold mt-0.5">
                          {formatPrice(release.retailPriceCents)}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => toggleReminder(release.id)}
                      disabled={isToggling}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isReminded
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                      } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isToggling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isReminded ? (
                        <BellOff className="h-4 w-4" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                      {isReminded ? "Reminded" : "Remind Me"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
