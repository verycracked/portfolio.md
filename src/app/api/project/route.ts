import { NextResponse } from "next/server";
import { isOwnerOrBearer } from "@/lib/extension-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // Accept either the owner cookie or a Snapshot extension bearer token —
  // the extension needs this list to let the user pick a destination
  // project when saving a screenshot.
  if (!(await isOwnerOrBearer(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // After merging the duplicate Project models, the canonical display field
  // is `title` (not `name`). We surface it under both keys for the extension's
  // existing payload shape so this route stays backwards compatible.
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { assets: true } },
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.title,
      title: p.title,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      assetCount: p._count.assets,
    })),
  });
}
