import { NextResponse } from "next/server";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";
import { uniqueSurfaceSlug } from "../helpers";

type Patch = {
  name?: string;
  slug?: string;
  body?: string;
  heroImageUrl?: string | null;
  order?: number;
};

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; surfaceId: string }> }
) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: projectId, surfaceId } = await params;
  const data = (await req.json()) as Patch;

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.body !== undefined) update.body = data.body;
  if (data.heroImageUrl !== undefined) update.heroImageUrl = data.heroImageUrl;
  if (data.order !== undefined) update.order = data.order;

  if (data.slug !== undefined) {
    update.slug = await uniqueSurfaceSlug(projectId, data.slug, surfaceId);
  }

  const surface = await prisma.surface.update({
    where: { id: surfaceId, projectId },
    data: update,
  });
  return NextResponse.json(surface);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; surfaceId: string }> }
) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: projectId, surfaceId } = await params;

  // Refuse to delete the last surface — a project must always have a tab.
  const count = await prisma.surface.count({ where: { projectId } });
  if (count <= 1) {
    return NextResponse.json(
      { error: "cannot delete the last surface" },
      { status: 400 }
    );
  }

  await prisma.surface.delete({ where: { id: surfaceId, projectId } });
  return NextResponse.json({ ok: true });
}
