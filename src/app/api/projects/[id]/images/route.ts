import { NextResponse } from "next/server";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { url, caption, surfaceId } = (await req.json()) as {
    url?: string;
    caption?: string;
    surfaceId?: string;
  };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  // Resolve target surface. Callers may omit it; we then attach to the
  // project's first surface (creation order) so existing extension clients
  // keep working without changes.
  let targetSurfaceId = surfaceId;
  if (!targetSurfaceId) {
    const first = await prisma.surface.findFirst({
      where: { projectId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!first) {
      return NextResponse.json(
        { error: "project has no surfaces" },
        { status: 400 }
      );
    }
    targetSurfaceId = first.id;
  }

  const last = await prisma.projectImage.findFirst({
    where: { surfaceId: targetSurfaceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const image = await prisma.projectImage.create({
    data: {
      projectId: id,
      surfaceId: targetSurfaceId,
      url,
      caption,
      order,
    },
  });
  return NextResponse.json(image);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("imageId");
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });

  await prisma.projectImage.delete({
    where: { id: imageId, projectId },
  });
  return NextResponse.json({ ok: true });
}
