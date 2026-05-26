import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** PUT — rename a group. Body: `{ name: string }`. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "`name` required" }, { status: 400 });
  }
  const name = body.name.trim() || "Untitled";
  const group = await prisma.group.update({ where: { id }, data: { name } });
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
