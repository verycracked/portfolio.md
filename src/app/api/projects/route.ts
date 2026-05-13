import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isAuthed } from "@/lib/auth";
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

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    sourceUrl?: string;
  };

  const title = body.title?.trim() || "Untitled";
  let slug = slugify(title);

  // ensure unique
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${nanoid(4)}`;

  const last = await prisma.project.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const project = await prisma.project.create({
    data: { slug, title, sourceUrl: body.sourceUrl, order },
  });
  return NextResponse.json(project);
}
