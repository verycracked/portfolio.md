import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Patch = {
  title?: string;
  description?: string;
  heroImageUrl?: string | null;
  posterUrl?: string | null;
  hasAudio?: boolean;
  isOpenable?: boolean;
  colSpan?: number;
  rowSpan?: number;
  heroOffsetY?: number;
  links?: Array<{ label: string; url: string }>;
  parentId?: string | null;
  viewGroupId?: string | null;
};

/** PUT — patch any subset of fields on a ViewProject. Mirrors the
 *  canonical `/api/projects/[id]` route's PUT shape so the client gallery
 *  can call through the gallery-scope helper without branching. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; pid: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug: viewId, pid } = await params;
  const data = (await req.json()) as Patch;

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.heroImageUrl !== undefined) update.heroImageUrl = data.heroImageUrl;
  if (data.posterUrl !== undefined) update.posterUrl = data.posterUrl;
  if (data.hasAudio !== undefined) update.hasAudio = Boolean(data.hasAudio);
  if (data.isOpenable !== undefined) update.isOpenable = Boolean(data.isOpenable);
  if (data.colSpan !== undefined) {
    update.colSpan = Math.min(12, Math.max(1, Math.round(data.colSpan)));
  }
  if (data.rowSpan !== undefined) {
    update.rowSpan = Math.min(12, Math.max(1, Math.round(data.rowSpan)));
  }
  if (data.heroOffsetY !== undefined) {
    const n = Number(data.heroOffsetY);
    if (Number.isFinite(n)) {
      update.heroOffsetY = Math.max(0, Math.min(100, n));
    }
  }
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
  if (data.parentId !== undefined) update.parentId = data.parentId;
  if (data.viewGroupId !== undefined) update.viewGroupId = data.viewGroupId;

  const project = await prisma.viewProject.update({
    where: { id: pid, viewId },
    data: update,
  });
  return NextResponse.json(project);
}

/** DELETE — remove a ViewProject (cascades to its children). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; pid: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug: viewId, pid } = await params;
  await prisma.viewProject.delete({ where: { id: pid, viewId } });
  return NextResponse.json({ ok: true });
}
