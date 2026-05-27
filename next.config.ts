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
      // GitHub avatars — the default `OWNER_AVATAR_URL` points here.
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
    // WebP first — Chrome's AVIF encoder over-smooths fine UI detail
    // (small text, edges in screenshots). WebP keeps screenshots crisp;
    // AVIF still serves to browsers that prefer it.
    formats: ["image/webp", "image/avif"],
    // Allow callers to opt into 92 (visibly sharper for screenshots),
    // alongside the default 75 for cases where size matters more than
    // pixel-perfect detail.
    qualities: [75, 92],
  },
};

export default nextConfig;
