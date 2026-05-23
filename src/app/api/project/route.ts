import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { assets: true } },
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      assetCount: p._count.assets,
    })),
  });
}
