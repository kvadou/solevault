// Mock Entrupy AI authentication service
// Replace with real Entrupy API integration in Phase D

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

/**
 * Mock Entrupy verification.
 * Simulates a 2-3 second delay and returns deterministic results based on image count.
 * - 6+ images: verified (score 92-98)
 * - 4-5 images: needs_review (score 75-85)
 * - <4 images: failed (score 40-60)
 */
export async function submitForVerification(
  req: EntrupySubmitRequest
): Promise<EntrupyResult> {
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
