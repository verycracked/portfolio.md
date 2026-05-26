/**
 * One-off backfill: for every Project whose heroImageUrl points at a video
 * and that has no posterUrl yet, render the video in headless Chromium,
 * pull the first decoded frame off a canvas as a JPEG, upload it to R2 at
 * `<videoKey>.poster.jpg`, and persist the public URL on the Project.
 *
 * Run with:
 *   pnpm exec tsx scripts/backfill-posters.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { chromium } from "playwright-core";
import { isVideoUrl } from "../src/lib/media";

const prisma = new PrismaClient();
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});
const R2_BUCKET = process.env.R2_BUCKET ?? "";
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

async function extractFrame(
  page: import("playwright-core").Page,
  url: string
): Promise<Buffer | null> {
  // Download the video bytes in Node first, then hand them to the page as a
  // base64 data URL. This sidesteps any CORS / mixed-origin oddness with
  // about:blank pages and lets us decode with the system Chrome's codec
  // stack inside the headless browser.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  const contentType = res.headers.get("content-type") ?? "video/mp4";
  const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;

  await page.setContent(
    `<!doctype html><html><body style="margin:0">
       <video id="v" muted playsinline preload="auto"></video>
       <canvas id="c"></canvas>
     </body></html>`,
    { waitUntil: "domcontentloaded" }
  );
  const jpegB64 = await page.evaluate(async (vidDataUrl) => {
    const v = document.getElementById("v") as HTMLVideoElement;
    v.muted = true;
    v.src = vidDataUrl;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => {
        try {
          v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
        } catch (err) {
          reject(err);
        }
      };
      v.onseeked = () => resolve();
      v.onerror = () =>
        reject(new Error(`video error ${v.error?.code ?? "?"}`));
      setTimeout(() => reject(new Error("timeout")), 30_000);
    });
    const c = document.getElementById("c") as HTMLCanvasElement;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const out = c.toDataURL("image/jpeg", 0.85);
    const m = /^data:image\/jpeg;base64,(.+)$/.exec(out);
    return m ? m[1] : null;
  }, dataUrl);
  return jpegB64 ? Buffer.from(jpegB64, "base64") : null;
}

async function main() {
  const candidates = await prisma.project.findMany({
    where: { posterUrl: null, heroImageUrl: { not: null } },
    select: { id: true, slug: true, title: true, heroImageUrl: true },
  });
  const videos = candidates.filter(
    (p) => p.heroImageUrl && isVideoUrl(p.heroImageUrl)
  );
  console.log(`Found ${videos.length} videos to backfill`);

  if (videos.length === 0) {
    await prisma.$disconnect();
    return;
  }

  // Playwright's bundled Chromium ships without proprietary codecs (H.264).
  // Use the user's system Chrome where present so videos actually decode.
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({
    headless: true,
    executablePath: systemChrome,
  });
  const page = await browser.newPage();

  for (const p of videos) {
    const videoUrl = p.heroImageUrl as string;
    process.stdout.write(`• ${p.slug} … `);
    try {
      const jpeg = await extractFrame(page, videoUrl);
      if (!jpeg) {
        console.log("no frame");
        continue;
      }
      // Mirror the video's R2 key, swapping the extension for .poster.jpg.
      const baseKey = new URL(videoUrl).pathname.replace(/^\//, "");
      const posterKey = `${baseKey.replace(/\.[^.]+$/, "")}.poster.jpg`;
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: posterKey,
          Body: jpeg,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      const posterUrl = `${R2_PUBLIC_URL}/${posterKey}`;
      await prisma.project.update({
        where: { id: p.id },
        data: { posterUrl },
      });
      console.log("ok");
    } catch (err) {
      console.log(
        "failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  await browser.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
