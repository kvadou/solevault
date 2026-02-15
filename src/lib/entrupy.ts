// Entrupy AI authentication service
// Live mode: calls Entrupy API when ENTRUPY_API_KEY is set
// Mock mode: deterministic results for development/testing

export interface EntrupySubmitRequest {
  imageUrls: string[];
  brand: string;
  model: string;
  styleCode?: string;
}

export interface EntrupyResult {
  externalCertId: string;
  confidenceScore: number;
  status: "verified" | "needs_review" | "failed";
  resultData: Record<string, unknown>;
}

const ENTRUPY_BASE_URL =
  process.env.ENTRUPY_BASE_URL || "https://api.entrupy.com/v1";
const ENTRUPY_API_KEY = process.env.ENTRUPY_API_KEY;

/**
 * Returns the current Entrupy operating mode.
 */
export function getEntrupyMode(): "live" | "mock" {
  return ENTRUPY_API_KEY ? "live" : "mock";
}

/**
 * Parses a raw Entrupy API response into an EntrupyResult.
 * Used by both the live client and the webhook handler.
 */
export function parseEntrupyResponse(data: Record<string, unknown>): EntrupyResult {
  const certId = (data.certificate_id as string) ||
    (data.job_id as string) ||
    (data.id as string) ||
    `ENTRUPY-${Date.now()}`;

  const rawScore = data.confidence_score ?? data.confidence ?? data.score;
  const confidenceScore =
    typeof rawScore === "number"
      ? Math.round(rawScore * (rawScore <= 1 ? 100 : 1))
      : 0;

  let status: EntrupyResult["status"];
  const rawStatus = (data.status as string) || (data.result as string) || "";

  if (
    rawStatus === "authentic" ||
    rawStatus === "verified" ||
    rawStatus === "passed"
  ) {
    status = "verified";
  } else if (
    rawStatus === "counterfeit" ||
    rawStatus === "failed" ||
    rawStatus === "unidentifiable"
  ) {
    status = "failed";
  } else {
    status = "needs_review";
  }

  // Override status based on confidence thresholds when applicable
  if (confidenceScore >= 90 && status !== "failed") {
    status = "verified";
  } else if (confidenceScore > 0 && confidenceScore < 70 && status !== "verified") {
    status = "failed";
  }

  return {
    externalCertId: certId,
    confidenceScore,
    status,
    resultData: {
      provider: "entrupy",
      rawResponse: data,
      analysisTimestamp: new Date().toISOString(),
    },
  };
}

/**
 * Submit sneaker photos for Entrupy verification.
 * Uses live Entrupy API when ENTRUPY_API_KEY is configured,
 * otherwise falls back to mock implementation.
 */
export async function submitForVerification(
  req: EntrupySubmitRequest
): Promise<EntrupyResult> {
  if (getEntrupyMode() === "live") {
    return submitLive(req);
  }
  return submitMock(req);
}

/* ------------------------------------------------------------------ */
/*  Live Entrupy API                                                   */
/* ------------------------------------------------------------------ */

async function submitLive(req: EntrupySubmitRequest): Promise<EntrupyResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/webhooks/entrupy`;

  const response = await fetch(`${ENTRUPY_BASE_URL}/authentications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENTRUPY_API_KEY}`,
    },
    body: JSON.stringify({
      image_urls: req.imageUrls,
      brand: req.brand,
      model: req.model,
      style_code: req.styleCode,
      webhook_url: webhookUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Entrupy API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Async processing: Entrupy will call our webhook when done
  if (data.status === "processing" || (data.job_id && !data.confidence_score && !data.confidence)) {
    return {
      externalCertId: data.job_id || data.id || `ENTRUPY-${Date.now()}`,
      confidenceScore: 0,
      status: "needs_review",
      resultData: {
        provider: "entrupy",
        mode: "async",
        jobId: data.job_id || data.id,
        submittedAt: new Date().toISOString(),
      },
    };
  }

  // Synchronous result
  return parseEntrupyResponse(data);
}

/* ------------------------------------------------------------------ */
/*  Mock Entrupy (development / testing)                               */
/* ------------------------------------------------------------------ */

/**
 * Mock Entrupy verification.
 * Simulates a 2-3 second delay and returns deterministic results based on image count.
 * - 6+ images: verified (score 92-98)
 * - 4-5 images: needs_review (score 75-85)
 * - <4 images: failed (score 40-60)
 */
async function submitMock(req: EntrupySubmitRequest): Promise<EntrupyResult> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));

  const imageCount = req.imageUrls.length;
  const certId = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (imageCount >= 6) {
    const score = 92 + Math.floor(Math.random() * 7); // 92-98
    return {
      externalCertId: certId,
      confidenceScore: score,
      status: "verified",
      resultData: {
        provider: "entrupy-mock",
        imageCount,
        brand: req.brand,
        model: req.model,
        analysisTimestamp: new Date().toISOString(),
      },
    };
  }

  if (imageCount >= 4) {
    const score = 75 + Math.floor(Math.random() * 11); // 75-85
    return {
      externalCertId: certId,
      confidenceScore: score,
      status: "needs_review",
      resultData: {
        provider: "entrupy-mock",
        imageCount,
        reason: "Insufficient angles for high-confidence result",
        brand: req.brand,
        model: req.model,
        analysisTimestamp: new Date().toISOString(),
      },
    };
  }

  const score = 40 + Math.floor(Math.random() * 21); // 40-60
  return {
    externalCertId: certId,
    confidenceScore: score,
    status: "failed",
    resultData: {
      provider: "entrupy-mock",
      imageCount,
      reason: "Too few images for reliable authentication",
      brand: req.brand,
      model: req.model,
      analysisTimestamp: new Date().toISOString(),
    },
  };
}
