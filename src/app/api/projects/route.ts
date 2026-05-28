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
    // parentId lets the snapshot extension render parent → child grouping
    // in its target picker. Kept additive so older clients ignore it.
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      parentId: true,
    },
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
    /** Section to drop the new tile into. Falls back to the last group
     *  (creating one if none exist) so the API is forgiving for legacy
     *  callers like the snapshot extension. */
    groupId?: string;
    /** Optional parent project. When set, the new tile is a sub-project
     *  that lives on the parent's detail page instead of the homepage
     *  gallery, and `groupId` is ignored (sub-projects don't belong to
     *  sections). */
    parentId?: string;
    /** True when this row should be created as a project (detail page,
     *  named) rather than a media tile. Defaults to false. */
    isOpenable?: boolean;
  };

  // Empty title is meaningful — "media tile, not a project." Don't coerce
  // to "Untitled" anymore; the UI treats empty as media.
  const titleRaw = body.title ?? "";
  const title = titleRaw.trim();
  // Slug source — fall back to a random suffix when there's no title so
  // the URL space stays unique. Media tiles aren't addressable anyway
  // (the detail route redirects them home).
  let slug = slugify(title) || nanoid(8);

  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${nanoid(4)}`;

  // Sub-projects live under their parent — they don't belong to a section.
  // Top-level projects resolve a section (defaulting to the last group, or
  // a freshly-created "Untitled" if the table is empty).
  let groupId: string | null = null;
  if (!body.parentId) {
    if (body.groupId) {
      groupId = body.groupId;
    } else {
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
  }

  // Per-bucket order — last + 1 so new tiles land at the end of whatever
  // grid they're going into (per-parent for sub-projects, per-group for
  // top-level).
  const orderScope = body.parentId
    ? { parentId: body.parentId }
    : { groupId: groupId ?? undefined, parentId: null };
  const last = await prisma.project.findFirst({
    where: orderScope,
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
      isOpenable: body.isOpenable ?? false,
      // Free-form bento grid is 12 cols wide; default new tiles to a
      // 6×6 patch — half the row, near-square at typical container
      // widths. Big enough to feel like a real tile right away; owner
      // can shrink with the resize handle if they want something denser.
      colSpan: 6,
      rowSpan: 6,
      order,
      groupId,
      parentId: body.parentId ?? null,
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
