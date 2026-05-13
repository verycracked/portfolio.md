import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { launch } from "@/lib/browser";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  url?: string;
  width?: number;
  height?: number;
  fullPage?: boolean;
};

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254"];

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  if (!body.url) return NextResponse.json({ error: "url required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "invalid protocol" }, { status: 400 });
  }
  if (BLOCKED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "blocked host" }, { status: 400 });
  }

  const width = Math.min(Math.max(body.width ?? 1280, 320), 1920);
  const height = Math.min(Math.max(body.height ?? 800, 240), 1200);

  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: "light",
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(parsed.toString(), { waitUntil: "networkidle", timeout: 25_000 });
    const buffer = await page.screenshot({ type: "png", fullPage: body.fullPage ?? false });

    const key = `captures/${nanoid(16)}.png`;
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    const url = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
    await prisma.asset.create({
      data: { url, key, mime: "image/png", size: buffer.length },
    });
    return NextResponse.json({ url, sourceUrl: parsed.toString() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "capture failed" },
      { status: 500 }
    );
  } finally {
    await browser.close();
  }
}
