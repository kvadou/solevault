"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { SlideOver } from "@/components/ui/SlideOver";
import { statusColor } from "@/lib/utils";

interface CertificateData {
  certificate: {
    id: string;
    confidenceScore: number | null;
    status: string;
    verifiedAt: string | null;
    imageUrls: string[];
  };
}

interface VerificationPreviewProps {
  open: boolean;
  onClose: () => void;
  certData: CertificateData | null;
  loading: boolean;
}

export function VerificationPreview({ open, onClose, certData, loading }: VerificationPreviewProps) {
  return (
    <SlideOver open={open} onClose={onClose} title="Verification Details">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : certData ? (
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600">
              {certData.certificate.confidenceScore ?? "\u2014"}%
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">Confidence Score</p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(certData.certificate.status)}`}>
              {certData.certificate.status.replace("_", " ")}
            </span>
            {certData.certificate.verifiedAt && (
              <span className="text-[var(--muted-foreground)]">
                {new Date(certData.certificate.verifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {certData.certificate.imageUrls.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Submitted Photos</p>
              <div className="grid grid-cols-3 gap-2">
                {certData.certificate.imageUrls.map((url, i) => (
                  <div key={i} className="aspect-square relative rounded-md overflow-hidden bg-[var(--muted)]">
                    <Image src={url} alt="" fill className="object-cover" sizes="120px" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            href={`/verify/${certData.certificate.id}`}
            className="block w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            View Full Trust Profile
          </Link>
        </div>
      ) : null}
    </SlideOver>
  );
}

// Hook for fetching certificate data and managing slide-over state
export function useVerificationPreview() {
  const [showVerification, setShowVerification] = useState(false);
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [loadingCert, setLoadingCert] = useState(false);

  async function openPreview(certificateId: string) {
    setShowVerification(true);
    setLoadingCert(true);
    try {
      const res = await fetch(`/api/verify/certificate/${certificateId}`);
      if (res.ok) {
        setCertData(await res.json());
      }
    } catch {
      // silently fail -- user can close and try again
    }
    setLoadingCert(false);
  }

  function closePreview() {
    setShowVerification(false);
    setCertData(null);
  }

  return { showVerification, certData, loadingCert, openPreview, closePreview };
}
