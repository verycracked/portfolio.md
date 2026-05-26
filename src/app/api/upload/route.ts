import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { humanize, isValidSlug, slugify } from "@/lib/slug";

const MAX_BYTES = 8 * 1024 * 1024;
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

export async function POST(req: Request) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "unsupported type" }, { status: 415 });
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

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  await prisma.asset.create({
    data: { url, key, mime: file.type, size: file.size, projectId },
  });

  return NextResponse.json({ url, project: projectSlug });
}
