import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { humanize, isValidSlug, slugify } from "@/lib/slug";

// Per-kind size caps. Images stay tight (8 MB is plenty for hero stills);
// videos get a much bigger budget since even short clips routinely run past
// the image cap.
const MAX_BYTES_IMAGE = 8 * 1024 * 1024; // 8 MB
const MAX_BYTES_VIDEO = 100 * 1024 * 1024; // 100 MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
]);

function maxBytesFor(mime: string): number {
  return mime.startsWith("video/") ? MAX_BYTES_VIDEO : MAX_BYTES_IMAGE;
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function POST(req: Request) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported type "${file.type || "unknown"}". Use jpg, png, gif, webp, avif, svg, mp4, or webm.`,
      },
      { status: 415 }
    );
  }
  const max = maxBytesFor(file.type);
  if (file.size > max) {
    return NextResponse.json(
      {
        error: `File is ${mb(file.size)}; ${file.type.startsWith("video/") ? "videos" : "images"} are capped at ${mb(max)}.`,
      },
      { status: 413 }
    );
  }

  const projectRaw = form.get("project");
  let projectId: string | null = null;
  let projectSlug: string | null = null;

  if (typeof projectRaw === "string" && projectRaw.trim() !== "") {
    const slug = slugify(projectRaw);
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: "invalid project slug" }, { status: 400 });
    }

    const nameRaw = form.get("projectName");
    const title =
      typeof nameRaw === "string" && nameRaw.trim() !== ""
        ? nameRaw.trim().slice(0, 100)
        : humanize(slug);

    // Auto-create projects on upload (for the extension flow). Existing projects
    // are matched by slug; we never overwrite the owner's title via this path.
    const project = await prisma.project.upsert({
      where: { slug },
      update: {},
      create: { slug, title },
    });
    projectId = project.id;
    projectSlug = project.slug;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const key = projectSlug
    ? `${projectSlug}/${nanoid(16)}.${ext}`
    : `${nanoid(16)}.${ext}`;
  const body = new Uint8Array(await file.arrayBuffer());

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (err) {
    // Surface the cause so we can read it in Vercel logs instead of a
    // generic 500. R2 misconfiguration (bad bucket / key / region) is the
    // most common failure here.
    console.error("R2 upload failed", {
      key,
      bucket: R2_BUCKET,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: `R2 upload failed: ${err instanceof Error ? err.message : "unknown"}`,
      },
      { status: 502 }
    );
  }

  const url = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  try {
    await prisma.asset.create({
      data: { url, key, mime: file.type, size: file.size, projectId },
    });
  } catch (err) {
    console.error("asset insert failed", {
      key,
      message: err instanceof Error ? err.message : String(err),
    });
    // The file is in R2 already; return the URL so the client can keep
    // moving. The orphan asset row will just be missing.
  }

  return NextResponse.json({ url, project: projectSlug });
}
