import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type LegacyBody = { ids?: unknown };
type GroupedBody = {
  /** Homepage shape: groups in desired top-to-bottom order, each with its
   *  own ordered list of project ids. One call rewrites both within-section
   *  order and the section assignment of every tile. */
  groups?: unknown;
};
type ParentBody = {
  /** Sub-project shape: reorder children inside a single parent. Sets
   *  each project's `order` to its index and ensures `parentId` matches.
   *  Used by the project detail page's sub-gallery. */
  parentId?: unknown;
  childIds?: unknown;
};
type Body = LegacyBody & GroupedBody & ParentBody;

/**
 * POST — owner-only bulk reorder. Two payloads:
 *
 *   { ids: ["projA", "projB", …] }
 *     Legacy flat reorder (single-group worlds). Sets each project's
 *     `order` to its index. groupId is left untouched.
 *
 *   { groups: [{ id, projectIds: [...] }, ...] }
 *     New shape — sets each project's groupId and order in one shot so a
 *     cross-section drag commits atomically.
 *
 * Everything runs in a single transaction so the DB is never in a half-
 * applied state mid-reorder.
 */
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;

  // Parent-scoped reorder — used by the project detail page's sub-gallery.
  if (typeof body.parentId === "string" && Array.isArray(body.childIds)) {
    const parentId = body.parentId;
    const childIds = body.childIds;
    if (childIds.some((id) => typeof id !== "string")) {
      return NextResponse.json(
        { error: "childIds must be strings" },
        { status: 400 }
      );
    }
    const ids = childIds as string[];
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.project.update({
          where: { id },
          data: { parentId, order: index },
        })
      )
    );
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (Array.isArray(body.groups)) {
    const groups = body.groups as Array<{
      id?: unknown;
      projectIds?: unknown;
    }>;
    // Validate the entire payload up front so we don't kick off a partial
    // transaction and bail halfway.
    const updates: Array<{ id: string; groupId: string; order: number }> = [];
    for (const g of groups) {
      if (typeof g.id !== "string") {
        return NextResponse.json(
          { error: "each group needs a string id" },
          { status: 400 }
        );
      }
      if (!Array.isArray(g.projectIds)) {
        return NextResponse.json(
          { error: "each group needs projectIds[]" },
          { status: 400 }
        );
      }
      for (let i = 0; i < g.projectIds.length; i++) {
        const pid = g.projectIds[i];
        if (typeof pid !== "string") {
          return NextResponse.json(
            { error: "projectIds must be strings" },
            { status: 400 }
          );
        }
        updates.push({ id: pid, groupId: g.id, order: i });
      }
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.project.update({
          where: { id: u.id },
          data: { groupId: u.groupId, order: u.order },
        })
      )
    );
    return NextResponse.json({ ok: true, count: updates.length });
  }

  const { ids } = body;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "`ids` must be an array of strings, or supply `groups`" },
      { status: 400 }
    );
  }
  const stringIds = ids as string[];
  await prisma.$transaction(
    stringIds.map((id, index) =>
      prisma.project.update({ where: { id }, data: { order: index } })
    )
  );
  return NextResponse.json({ ok: true, count: stringIds.length });
}
