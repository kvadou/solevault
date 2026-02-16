import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntrupyMode } from "@/lib/entrupy";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Status counts
  const statusCounts = await prisma.authenticationCertificate.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  // Total submissions
  const totalSubmissions = statusCounts.reduce(
    (sum, s) => sum + s._count.id,
    0
  );

  // Pass rate
  const verifiedCount =
    statusCounts.find((s) => s.status === "verified")?._count.id ?? 0;
  const passRate =
    totalSubmissions > 0
      ? Math.round((verifiedCount / totalSubmissions) * 1000) / 10
      : 0;

  // Average confidence score
  const avgResult = await prisma.authenticationCertificate.aggregate({
    _avg: { confidenceScore: true },
    where: { confidenceScore: { not: null } },
  });
  const avgConfidenceScore = avgResult._avg.confidenceScore
    ? Math.round(avgResult._avg.confidenceScore * 10) / 10
    : 0;

  // Monthly trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentCerts = await prisma.authenticationCertificate.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const monthlyMap = new Map<
    string,
    { total: number; verified: number; failed: number; needs_review: number; disputed: number }
  >();

  for (const cert of recentCerts) {
    const month = cert.createdAt.toISOString().slice(0, 7); // YYYY-MM
    const entry = monthlyMap.get(month) || {
      total: 0,
      verified: 0,
      failed: 0,
      needs_review: 0,
      disputed: 0,
    };
    entry.total++;
    if (cert.status === "verified") entry.verified++;
    else if (cert.status === "failed") entry.failed++;
    else if (cert.status === "needs_review") entry.needs_review++;
    else if (cert.status === "disputed") entry.disputed++;
    monthlyMap.set(month, entry);
  }

  const monthlyTrend = Array.from(monthlyMap.entries()).map(
    ([month, counts]) => ({
      month,
      ...counts,
    })
  );

  return NextResponse.json({
    mode: getEntrupyMode(),
    statusCounts: statusCounts.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    monthlyTrend,
    avgConfidenceScore,
    passRate,
    totalSubmissions,
  });
}
