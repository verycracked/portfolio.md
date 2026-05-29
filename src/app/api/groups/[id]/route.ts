import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** PUT — update a group. Body: `{ name?: string, linkUrl?: string }`. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    linkUrl?: string;
  };
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    update.name = body.name.trim() || "Untitled";
  }
  if (typeof body.linkUrl === "string") {
    update.linkUrl = body.linkUrl.trim();
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  const group = await prisma.group.update({ where: { id }, data: update });
  return NextResponse.json(group);
}

/**
 * DELETE — delete a group AND every project inside it (cascading the tiles,
 * surfaces, images). User confirmed in the UI; this is intentional.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  // First yank the tiles (cascades surfaces / images / assets), then the
  // group itself. Wrapped in a transaction so a partial failure leaves the
  // group standing rather than orphaning projects.
  await prisma.$transaction([
    prisma.project.deleteMany({ where: { groupId: id } }),
    prisma.group.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
