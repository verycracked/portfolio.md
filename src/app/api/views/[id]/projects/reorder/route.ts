import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type LegacyBody = { ids?: unknown };
type GroupedBody = { groups?: unknown };
type ParentBody = { parentId?: unknown; childIds?: unknown };
type Body = LegacyBody & GroupedBody & ParentBody;

/** POST — bulk reorder ViewProject rows. Three payload shapes mirror the
 *  canonical /api/projects/reorder route:
 *
 *    { ids: [...] }                     — flat reorder
 *    { groups: [{id, projectIds: [...]}, ...] } — cross-section reorder
 *    { parentId, childIds: [...] }      — sub-project reorder
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: viewId } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  // Sub-project reorder under a parent ViewProject.
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
        prisma.viewProject.update({
          where: { id, viewId },
          data: { parentId, order: index },
        })
      )
    );
    return NextResponse.json({ ok: true, count: ids.length });
  }

  // Cross-section reorder: each group's projectIds in target order.
  if (Array.isArray(body.groups)) {
    const groups = body.groups as Array<{ id?: unknown; projectIds?: unknown }>;
    const updates: Array<{ id: string; viewGroupId: string; order: number }> = [];
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
        updates.push({ id: pid, viewGroupId: g.id, order: i });
      }
    }
    await prisma.$transaction(
      updates.map((u) =>
        prisma.viewProject.update({
          where: { id: u.id, viewId },
          data: { viewGroupId: u.viewGroupId, order: u.order },
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
      prisma.viewProject.update({
        where: { id, viewId },
        data: { order: index },
      })
    )
  );
  return NextResponse.json({ ok: true, count: stringIds.length });
}
