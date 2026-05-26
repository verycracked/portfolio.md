import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return base || nanoid(8);
}

export async function GET(req: Request) {
  // Listing is owner-or-bearer-only; we don't want public enumeration.
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projects = await prisma.project.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, slug: true, title: true, description: true },
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    sourceUrl?: string;
    heroImageUrl?: string;
    /** Optional poster still — required for videos to display anything on
     *  iOS Safari without autoplay; auto-extracted client-side at upload. */
    posterUrl?: string;
    /** Section to drop the new tile into. Falls back to the first group
     *  (creating one if none exist) so the API is forgiving for legacy
     *  callers like the snapshot extension. */
    groupId?: string;
  };

  const title = body.title?.trim() || "Untitled";
  let slug = slugify(title);

  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${nanoid(4)}`;

  // Resolve target section. If the caller didn't specify one, use the last
  // existing group (so global drag-anywhere uploads land at the bottom of
  // the page, not at the top); create the default "Untitled" group on the
  // fly if the table is empty (only happens on a brand-new database).
  let groupId = body.groupId;
  if (!groupId) {
    const last = await prisma.group.findFirst({ orderBy: { order: "desc" } });
    if (last) {
      groupId = last.id;
    } else {
      const created = await prisma.group.create({
        data: { slug: "untitled", name: "Untitled", order: 0 },
      });
      groupId = created.id;
    }
  }

  // Per-group order — last + 1 so new tiles land at the end of their section.
  const last = await prisma.project.findFirst({
    where: { groupId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  // Every project ships with a default "Overview" surface so the editor and
  // the public page always have at least one tab to render.
  const project = await prisma.project.create({
    data: {
      slug,
      title,
      description: body.description ?? "",
      sourceUrl: body.sourceUrl,
      heroImageUrl: body.heroImageUrl,
      posterUrl: body.posterUrl,
      order,
      groupId,
      surfaces: {
        create: {
          slug: "overview",
          name: "Overview",
          heroImageUrl: body.heroImageUrl ?? null,
          order: 0,
        },
      },
    },
  });
  return NextResponse.json(project);
}
