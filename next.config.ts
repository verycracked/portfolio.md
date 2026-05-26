import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow the public R2 bucket as a remote image source so Next/Image can
    // resize, recompress, and serve webp/avif on the fly. Raw R2 URLs
    // (multi-megabyte PNG screenshots) load too slowly when used as-is on
    // small tiles; routing through the optimizer cuts payloads ~10×.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-4dad6c6f13224749b538f8b529c19047.r2.dev",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
