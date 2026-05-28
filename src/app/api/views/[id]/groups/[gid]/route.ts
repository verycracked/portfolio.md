import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Patch = { name?: string };

/** PUT — rename. Slug stays stable. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; gid: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: viewId, gid } = await params;
  const data = (await req.json()) as Patch;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  const group = await prisma.viewGroup.update({
    where: { id: gid, viewId },
    data: update,
  });
  return NextResponse.json(group);
}

/** DELETE — cascade removes all ViewProject rows in this section. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; gid: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: viewId, gid } = await params;
  await prisma.viewGroup.delete({ where: { id: gid, viewId } });
  return NextResponse.json({ ok: true });
}
