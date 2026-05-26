import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  /** Project ids in the desired left-to-right / top-to-bottom order. */
  ids?: unknown;
};

/**
 * POST — owner-only bulk reorder for project cards. Takes a list of project
 * ids in the desired order; each project's `order` field is set to its
 * index in the array, all inside a single transaction.
 */
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { ids } = (await req.json().catch(() => ({}))) as Body;

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "`ids` must be an array of strings" },
      { status: 400 }
    );
  }
  const stringIds = ids as string[];

  // One transactional batch of updates so the DB is never in a half-applied
  // state mid-reorder. Indexes start at 0; the gallery query orders by `order`.
  await prisma.$transaction(
    stringIds.map((id, index) =>
      prisma.project.update({ where: { id }, data: { order: index } })
    )
  );

  return NextResponse.json({ ok: true, count: stringIds.length });
}
