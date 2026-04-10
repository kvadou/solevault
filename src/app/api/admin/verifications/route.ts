import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "needs_review";

  const where =
    status === "all"
      ? { status: { in: ["needs_review", "failed", "disputed"] } }
      : { status };

  const certificates = await prisma.authenticationCertificate.findMany({
    where,
    include: {
      sneaker: {
        select: {
          brand: true,
          model: true,
          colorway: true,
          styleCode: true,
          imageUrl: true,
        },
      },
      vaultItem: {
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              sellerLevel: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });

  return NextResponse.json({ certificates });
}
