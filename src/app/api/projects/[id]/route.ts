import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { hashPassword } from "@/lib/project-auth";
import { prisma } from "@/lib/prisma";

type Body = {
  title?: string;
  slug?: string;
  description?: string;
  body?: string;
  heroImageUrl?: string | null;
  sourceUrl?: string | null;
  /** Raw password from owner. null/empty string clears protection. */
  password?: string | null;
  order?: number;
  /** Bento sizing on /portfolio. Clamped to 1..4 / 1..2. */
  colSpan?: number;
  rowSpan?: number;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const data = (await req.json()) as Body;

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.body !== undefined) update.body = data.body;
  if (data.heroImageUrl !== undefined) update.heroImageUrl = data.heroImageUrl;
  if (data.sourceUrl !== undefined) update.sourceUrl = data.sourceUrl;
  if (data.order !== undefined) update.order = data.order;
  if (data.colSpan !== undefined) {
    update.colSpan = Math.min(4, Math.max(1, Math.round(data.colSpan)));
  }
  if (data.rowSpan !== undefined) {
    update.rowSpan = Math.min(2, Math.max(1, Math.round(data.rowSpan)));
  }

  if (data.password !== undefined) {
    update.passwordHash = data.password ? hashPassword(data.password) : null;
  }

  if (data.slug !== undefined) {
    const cleaned = slugify(data.slug);
    if (!cleaned) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    const conflict = await prisma.project.findUnique({ where: { slug: cleaned } });
    if (conflict && conflict.id !== id) {
      return NextResponse.json({ error: "slug taken" }, { status: 409 });
    }
    update.slug = cleaned;
  }

  const project = await prisma.project.update({ where: { id }, data: update });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
