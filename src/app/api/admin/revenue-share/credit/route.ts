import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { creditPendingShares } from "@/lib/revenue-share";

export async function POST() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const totalCredited = await creditPendingShares();

  return NextResponse.json({
    success: true,
    totalCredited,
  });
}
