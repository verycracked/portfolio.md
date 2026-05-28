import { NextResponse } from "next/server";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";
import { isValidSlug } from "@/lib/slug";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Same auth as the list route — the extension reads this when the user
  // picks an existing project to attach a screenshot to.
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      assets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          url: true,
          key: true,
          mime: true,
          size: true,
          createdAt: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: project.id,
    slug: project.slug,
    name: project.title,
    title: project.title,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    assets: project.assets,
  });
}
