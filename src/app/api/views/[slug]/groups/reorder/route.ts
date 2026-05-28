import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST — reorder sections within a view. Body: `{ ids: [string,…] }`. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug: viewId } = await params;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  if (!Array.isArray(body.ids) || body.ids.some((x) => typeof x !== "string")) {
    return NextResponse.json(
      { error: "ids must be an array of strings" },
      { status: 400 }
    );
  }
  const ids = body.ids as string[];
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.viewGroup.update({
        where: { id, viewId },
        data: { order: index },
      })
    )
  );
  return NextResponse.json({ ok: true, count: ids.length });
}
