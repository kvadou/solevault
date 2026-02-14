import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submissions = await prisma.vaultSubmission.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      vaultItems: { include: { sneaker: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(submissions);
}
