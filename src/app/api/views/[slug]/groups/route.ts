import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/** POST — create a new section inside this view. Body: `{ name?: string }`.
 *  Mirrors `/api/groups` but writes to the per-view `ViewGroup` table. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug: viewId } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim() || "Untitled";

  // Slug uniqueness is scoped to this view, not global — different views
  // can each have their own "untitled" without colliding.
  let slug = slugify(name) || nanoid(8);
  const collision = await prisma.viewGroup.findUnique({
    where: { viewId_slug: { viewId, slug } },
  });
  if (collision) slug = `${slug}-${nanoid(4)}`;

  const last = await prisma.viewGroup.findFirst({
    where: { viewId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const group = await prisma.viewGroup.create({
    data: { viewId, slug, name, order },
  });
  return NextResponse.json(group);
}
