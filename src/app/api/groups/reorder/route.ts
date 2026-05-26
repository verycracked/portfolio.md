import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST — owner-only bulk reorder for sections. Body: `{ ids: string[] }`. */
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown };
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "`ids` must be an array of strings" },
      { status: 400 }
    );
  }
  const stringIds = ids as string[];
  await prisma.$transaction(
    stringIds.map((id, index) =>
      prisma.group.update({ where: { id }, data: { order: index } })
    )
  );
  return NextResponse.json({ ok: true, count: stringIds.length });
}
