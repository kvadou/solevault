import { NextResponse } from "next/server";
import { recalculateAllTrustScores } from "@/lib/trust-score";

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await recalculateAllTrustScores();

  return NextResponse.json({
    success: true,
    ...result,
    calculatedAt: new Date().toISOString(),
  });
}
