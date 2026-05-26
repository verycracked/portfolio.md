import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/** POST — create a new section. Body: `{ name?: string }`. */
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim() || "Untitled";

  // Slug is mostly for tidy URLs / debugging; collisions get a short suffix.
  let slug = slugify(name) || nanoid(8);
  const existing = await prisma.group.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${nanoid(4)}`;

  const last = await prisma.group.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const group = await prisma.group.create({ data: { slug, name, order } });
  return NextResponse.json(group);
}
