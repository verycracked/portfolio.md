import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET — return the saved body for a slug, or 404 if no edit exists yet
 *  (the caller should then fall back to the on-disk seed). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const page = await prisma.page.findUnique({
    where: { slug },
    select: { body: true, updatedAt: true },
  });
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(page);
}

/** PUT — upsert the raw markdown body for a slug. Owner-only. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const { body } = (await req.json()) as { body?: string };
  if (typeof body !== "string") {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }
  const page = await prisma.page.upsert({
    where: { slug },
    update: { body },
    create: { slug, body },
  });
  return NextResponse.json({ body: page.body, updatedAt: page.updatedAt });
}
