import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/**
 * POST — create a new ViewProject tile inside a view. Mirrors the
 * canonical `/api/projects` create endpoint so the client can use the
 * same shape via the gallery-scope helper.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: viewId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    heroImageUrl?: string;
    posterUrl?: string;
    /** Optional ViewGroup id this new tile belongs to. */
    groupId?: string;
    /** Optional parent ViewProject id for sub-projects. */
    parentId?: string;
    isOpenable?: boolean;
  };

  const titleRaw = body.title ?? "";
  const title = titleRaw.trim();
  let slug = slugify(title) || nanoid(8);
  const collision = await prisma.viewProject.findUnique({
    where: { viewId_slug: { viewId, slug } },
  });
  if (collision) slug = `${slug}-${nanoid(4)}`;

  // Top-level tiles need a section; sub-projects don't. Same default-to-
  // last-group / create-untitled fallback the main API does, but on the
  // per-view tables.
  let viewGroupId: string | null = null;
  if (!body.parentId) {
    if (body.groupId) {
      viewGroupId = body.groupId;
    } else {
      const last = await prisma.viewGroup.findFirst({
        where: { viewId },
        orderBy: { order: "desc" },
      });
      if (last) {
        viewGroupId = last.id;
      } else {
        const created = await prisma.viewGroup.create({
          data: { viewId, slug: "untitled", name: "Untitled", order: 0 },
        });
        viewGroupId = created.id;
      }
    }
  }

  const orderScope = body.parentId
    ? { parentId: body.parentId }
    : { viewGroupId: viewGroupId ?? undefined, parentId: null };
  const last = await prisma.viewProject.findFirst({
    where: { viewId, ...orderScope },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const project = await prisma.viewProject.create({
    data: {
      viewId,
      viewGroupId,
      parentId: body.parentId ?? null,
      slug,
      title,
      description: body.description ?? "",
      heroImageUrl: body.heroImageUrl,
      posterUrl: body.posterUrl,
      isOpenable: body.isOpenable ?? false,
      colSpan: 6,
      rowSpan: 6,
      order,
    },
  });
  return NextResponse.json(project);
}
