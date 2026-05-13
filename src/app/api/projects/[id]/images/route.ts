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
  const { url, caption } = (await req.json()) as { url?: string; caption?: string };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const last = await prisma.projectImage.findFirst({
    where: { projectId: id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  const image = await prisma.projectImage.create({
    data: { projectId: id, url, caption, order },
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
