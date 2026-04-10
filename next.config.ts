import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "dpk",
  project: "solevault",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
