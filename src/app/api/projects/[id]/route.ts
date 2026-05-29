import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { isOwnerOrBearer } from "@/lib/extension-auth";
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
  /** Optional new section for the tile. */
  groupId?: string;
  /** Reparent this project under another (null moves it back to top-level). */
  parentId?: string | null;
  /** When true, surfaces the "Play" CTA + theater modal on the tile. */
  hasAudio?: boolean;
  /** Force the homepage tile to be clickable even with no sub-projects. */
  isOpenable?: boolean;
  /** Labeled links shown as hover buttons on the gallery tile. */
  links?: Array<{ label: string; url: string }>;
  /** Vertical framing (0–100) of the hero on the project detail page. */
  heroOffsetY?: number;
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

// GET /api/projects/[id] — full project row including `body` so non-browser
// clients (notably the portfolio-md MCP) can read the current state before
// patching. Owner-or-bearer gated; the list endpoint already enforces the
// same boundary so we match it here.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      body: true,
      heroImageUrl: true,
      sourceUrl: true,
      isOpenable: true,
      hasAudio: true,
      colSpan: true,
      rowSpan: true,
      order: true,
      groupId: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Bearer-allowed so the portfolio-md MCP can patch project metadata. Setting
  // a visitor password (`data.password`) still requires the cookie session
  // below — bearer tokens can't change auth surface area on their own.
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const data = (await req.json()) as Body;

  // Password mutation is owner-only. Surface a friendly 403 instead of a
  // silent passthrough so a misconfigured client doesn't think it worked.
  if (data.password !== undefined && !(await isAuthed())) {
    return NextResponse.json(
      { error: "password changes require the owner session" },
      { status: 403 }
    );
  }

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.body !== undefined) update.body = data.body;
  if (data.heroImageUrl !== undefined) update.heroImageUrl = data.heroImageUrl;
  if (data.sourceUrl !== undefined) update.sourceUrl = data.sourceUrl;
  if (data.links !== undefined) {
    update.links = Array.isArray(data.links)
      ? data.links.filter(
          (l: unknown) =>
            typeof l === "object" &&
            l !== null &&
            typeof (l as Record<string, unknown>).label === "string" &&
            typeof (l as Record<string, unknown>).url === "string"
        )
      : [];
  }
  if (data.order !== undefined) update.order = data.order;
  // Spans are clamped to the bento grid's column count (currently 12).
  // The DB column stays an Int with no DB-side check, so we own the
  // clamp here to avoid wild values poisoning the layout.
  if (data.colSpan !== undefined) {
    update.colSpan = Math.min(12, Math.max(1, Math.round(data.colSpan)));
  }
  if (data.rowSpan !== undefined) {
    update.rowSpan = Math.min(12, Math.max(1, Math.round(data.rowSpan)));
  }
  if (data.groupId !== undefined) update.groupId = data.groupId;
  if (data.parentId !== undefined) update.parentId = data.parentId;
  if (data.hasAudio !== undefined) update.hasAudio = Boolean(data.hasAudio);
  if (data.isOpenable !== undefined) update.isOpenable = Boolean(data.isOpenable);
  if (data.heroOffsetY !== undefined) {
    const n = Number(data.heroOffsetY);
    if (Number.isFinite(n)) {
      update.heroOffsetY = Math.max(0, Math.min(100, n));
    }
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
  // Deletes stay cookie-only: bearer tokens are scoped to "add to / update
  // existing content", not to destroy projects.
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
