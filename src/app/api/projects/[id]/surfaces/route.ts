import { NextResponse } from "next/server";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";
import { uniqueSurfaceSlug } from "./helpers";

// GET /api/projects/[id]/surfaces — list the surfaces (tabs) of a project,
// ordered by `order` then creation time. Owner/bearer only so that the editor
// is the single client (public reads happen via the page itself).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const surfaces = await prisma.surface.findMany({
    where: { projectId: id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(surfaces);
}

// POST /api/projects/[id]/surfaces — create a surface. Slug is derived from
// `name` unless an explicit slug is provided; we always disambiguate so two
// tabs in the same project never share a slug.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
  };

  const name = body.name?.trim() || "Untitled";
  const slug = await uniqueSurfaceSlug(id, body.slug ?? name);

  const last = await prisma.surface.findFirst({
    where: { projectId: id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const surface = await prisma.surface.create({
    data: { projectId: id, slug, name, order },
  });
  return NextResponse.json(surface);
}
