import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueViewSlug } from "@/lib/view-helpers";

type Patch = {
  name?: string;
  slug?: string;
  greeting?: string;
  showAbout?: boolean;
  showProjects?: boolean;
  projectIds?: string[];
  groupIds?: string[];
};

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug: id } = await params;
  const data = (await req.json()) as Patch;

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.greeting !== undefined) update.greeting = data.greeting;
  if (data.showAbout !== undefined) update.showAbout = Boolean(data.showAbout);
  if (data.showProjects !== undefined) {
    update.showProjects = Boolean(data.showProjects);
  }
  if (data.projectIds !== undefined) {
    update.projectIds = Array.isArray(data.projectIds)
      ? data.projectIds.filter((s) => typeof s === "string")
      : [];
  }
  if (data.groupIds !== undefined) {
    update.groupIds = Array.isArray(data.groupIds)
      ? data.groupIds.filter((s) => typeof s === "string")
      : [];
  }

  // Slug behavior: an explicit slug in the body always wins (lets the
  // owner customize the share URL independently). When no slug is
  // supplied but the name is, derive the slug from the name so renaming
  // a view automatically updates its share URL — `/v/<new-slug>`. Slugs
  // are deduped via uniqueViewSlug so renaming two views to the same
  // label produces stable, distinct links.
  if (data.slug !== undefined) {
    update.slug = await uniqueViewSlug(data.slug, id);
  } else if (data.name !== undefined) {
    update.slug = await uniqueViewSlug(data.name, id);
  }

  const view = await prisma.view.update({ where: { id }, data: update });
  return NextResponse.json(view);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug: id } = await params;
  await prisma.view.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
