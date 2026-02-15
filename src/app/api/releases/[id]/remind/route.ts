import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.releaseReminder.findUnique({
    where: { userId_releaseId: { userId: session.user.id!, releaseId: id } },
  });

  if (existing) {
    await prisma.releaseReminder.delete({ where: { id: existing.id } });
    return NextResponse.json({ reminded: false });
  } else {
    await prisma.releaseReminder.create({
      data: { userId: session.user.id!, releaseId: id },
    });
    return NextResponse.json({ reminded: true });
  }
}
