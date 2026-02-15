import { ShieldCheck, ShieldAlert } from "lucide-react";

interface TrustBadgeProps {
  score: number | null;
  size?: "sm" | "md";
}

export function TrustBadge({ score, size = "sm" }: TrustBadgeProps) {
  if (score === null) return null;

  const isExcellent = score >= 80;
  const isWarning = score < 40;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
          isExcellent
            ? "bg-green-100 text-green-700"
            : isWarning
            ? "bg-yellow-100 text-yellow-700"
            : "bg-blue-100 text-blue-700"
        }`}
        title={`Trust Score: ${score}/100`}
      >
        {isWarning ? (
          <ShieldAlert className="h-2.5 w-2.5" />
        ) : (
          <ShieldCheck className="h-2.5 w-2.5" />
        )}
        {score}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isExcellent
          ? "bg-green-100 text-green-700"
          : isWarning
          ? "bg-yellow-100 text-yellow-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {isWarning ? (
        <ShieldAlert className="h-3 w-3" />
      ) : (
        <ShieldCheck className="h-3 w-3" />
      )}
      Trust: {score}
    </span>
  );
}
