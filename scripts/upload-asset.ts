/**
 * One-off uploader for static assets to R2. Bypasses the HTTP /api/upload
 * route (which requires an owner cookie or bearer token) by talking to R2
 * directly with the same credentials. Prints the resulting public URL.
 *
 * Usage:
 *   pnpm dlx tsx scripts/upload-asset.ts <localPath> [keyPrefix]
 *
 * Example:
 *   pnpm dlx tsx scripts/upload-asset.ts ~/Downloads/vc_billingsley_2026.pdf cv
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config as loadEnv } from "dotenv";
import { nanoid } from "nanoid";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
};

async function main() {
  const [, , inputPath, prefix] = process.argv;
  if (!inputPath) {
    console.error("usage: tsx scripts/upload-asset.ts <localPath> [keyPrefix]");
    process.exit(1);
  }

  const absPath = inputPath.startsWith("~")
    ? path.join(process.env.HOME ?? "", inputPath.slice(1))
    : path.resolve(inputPath);

  const buf = await fs.readFile(absPath);
  const ext = path.extname(absPath).slice(1).toLowerCase() || "bin";
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const key = prefix
    ? `${prefix}/${nanoid(16)}.${ext}`
    : `${nanoid(16)}.${ext}`;

  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET ?? "",
      Key: key,
      Body: buf,
      ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const publicUrl = `${(process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "")}/${key}`;
  console.log(publicUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
