import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { parseEntrupyResponse } from "@/lib/entrupy";
import { Prisma } from "@prisma/client";

const ENTRUPY_WEBHOOK_SECRET = process.env.ENTRUPY_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // Verify HMAC-SHA256 signature if secret is configured
    if (ENTRUPY_WEBHOOK_SECRET) {
      const signature = req.headers.get("x-entrupy-signature");
      if (!signature) {
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 }
        );
      }

      const expectedSig = crypto
        .createHmac("sha256", ENTRUPY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      const sigBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSig, "hex");

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;

    // Extract job identifier
    const jobId =
      (payload.job_id as string) ||
      (payload.id as string) ||
      (payload.certificate_id as string);

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing job_id or id in payload" },
        { status: 400 }
      );
    }

    // Find the certificate by externalCertId
    const certificate = await prisma.authenticationCertificate.findFirst({
      where: { externalCertId: jobId },
    });

    if (!certificate) {
      console.warn(
        `[Entrupy Webhook] No certificate found for job_id: ${jobId}`
      );
      // Return 200 to prevent Entrupy from retrying
      return NextResponse.json({ received: true });
    }

    // Parse the Entrupy result
    const result = parseEntrupyResponse(payload);

    // Update the certificate
    await prisma.authenticationCertificate.update({
      where: { id: certificate.id },
      data: {
        confidenceScore: result.confidenceScore,
        status: result.status,
        resultData: result.resultData as Prisma.InputJsonValue,
        verifiedAt: result.status === "verified" ? new Date() : null,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Entrupy Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
