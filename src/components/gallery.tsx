"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import {
  GallerySection,
  VisitorGallerySection,
} from "@/components/gallery-section";
import type {
  GalleryGroup,
  GalleryProject,
} from "@/components/gallery-types";

const SAVE_DEBOUNCE_MS = 350;

/**
 * Section-aware project gallery. Visitors get a static stack of sections;
 * owners get drag-reorder of both tiles (within & across sections) and the
 * sections themselves, plus rename/delete/upload on each section.
 *
 * One <DndContext> wraps everything. Each section is its own
 * <SortableContext> for its tiles, plus a vertical SortableContext at the
 * top level for the sections themselves. We discriminate section vs tile
 * drags via the dnd-kit `data.kind` payload attached at registration time.
 */
export function Gallery({
  initial,
  owner,
  previewing = false,
}: {
  initial: GalleryGroup[];
  owner: boolean;
  previewing?: boolean;
}) {
  const router = useRouter();
  const editable = owner && !previewing;
  const [groups, setGroups] = useState<GalleryGroup[]>(initial);
  const [activeKind, setActiveKind] = useState<"tile" | "section" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Re-sync when the server data refreshes (post-upload, post-delete, etc.).
  useEffect(() => setGroups(initial), [initial]);

  // Ref mirror of `groups` so debounced timers always read the latest state
  // without stale-closure issues.
  const groupsRef = useRef<GalleryGroup[]>(groups);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  const reorderSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (reorderSaveTimer.current) clearTimeout(reorderSaveTimer.current);
      if (resizeSaveTimer.current) clearTimeout(resizeSaveTimer.current);
    },
    []
  );

  // ── Persistence ─────────────────────────────────────────────────────
  const persistProjectOrder = () => {
    if (reorderSaveTimer.current) clearTimeout(reorderSaveTimer.current);
    reorderSaveTimer.current = setTimeout(() => {
      const payload = {
        groups: groupsRef.current.map((g) => ({
          id: g.id,
          projectIds: g.projects.map((p) => p.id),
        })),
      };
      void fetch("/api/projects/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const persistGroupOrder = () => {
    void fetch("/api/groups/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ids: groupsRef.current.map((g) => g.id),
      }),
    });
  };

  // ── Drag handlers ───────────────────────────────────────────────────
  const handleDragStart = (e: DragStartEvent) => {
    const kind = (e.active.data.current as { kind?: string } | undefined)?.kind;
    setActiveKind(kind === "section" ? "section" : "tile");
  };

  const handleDragOver = (e: DragOverEvent) => {
    if (activeKind !== "tile") return;
    const { active, over } = e;
    if (!over) return;
    if (active.id === over.id) return;

    const overData = over.data.current as
      | { kind?: string; groupId?: string }
      | undefined;
    const overId = String(over.id);

    // Locate the dragged tile and its current home.
    let fromGroupIdx = -1;
    let fromTileIdx = -1;
    for (let gi = 0; gi < groups.length; gi++) {
      const ti = groups[gi].projects.findIndex((p) => p.id === active.id);
      if (ti !== -1) {
        fromGroupIdx = gi;
        fromTileIdx = ti;
        break;
      }
    }
    if (fromGroupIdx === -1) return;

    // Two over-target shapes: a sibling tile, or a section dropzone (for
    // empty sections / dropping at the end of a section).
    let toGroupIdx = -1;
    let toTileIdx = -1;

    if (overData?.kind === "section-dropzone") {
      toGroupIdx = groups.findIndex((g) => g.id === overData.groupId);
      if (toGroupIdx === -1) return;
      toTileIdx = groups[toGroupIdx].projects.length; // append
    } else {
      for (let gi = 0; gi < groups.length; gi++) {
        const ti = groups[gi].projects.findIndex((p) => p.id === overId);
        if (ti !== -1) {
          toGroupIdx = gi;
          toTileIdx = ti;
          break;
        }
      }
      if (toGroupIdx === -1) return;
    }

    // Within-section drag: defer the swap to dnd-kit's arrayMove via
    // handleDragEnd. Cross-section: move the tile into the target group at
    // the over-tile's index, so the visual updates while the gesture is
    // still in progress.
    if (fromGroupIdx === toGroupIdx) return;

    setGroups((cur) => {
      const next = cur.map((g) => ({ ...g, projects: [...g.projects] }));
      const [moved] = next[fromGroupIdx].projects.splice(fromTileIdx, 1);
      if (!moved) return cur;
      const target = next[toGroupIdx];
      const insertAt = Math.min(toTileIdx, target.projects.length);
      target.projects.splice(insertAt, 0, moved);
      return next;
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const wasKind = activeKind;
    setActiveKind(null);
    const { active, over } = e;
    if (!over) return;

    // Section reorder
    if (wasKind === "section") {
      if (active.id === over.id) return;
      const oldIndex = groups.findIndex(
        (g) => `section:${g.id}` === active.id
      );
      const newIndex = groups.findIndex((g) => `section:${g.id}` === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(groups, oldIndex, newIndex);
      setGroups(next);
      groupsRef.current = next;
      persistGroupOrder();
      return;
    }

    // Tile reorder within the same section. (Cross-section was applied
    // optimistically in handleDragOver.)
    const fromGroup = groups.find((g) =>
      g.projects.some((p) => p.id === active.id)
    );
    const toGroup = groups.find((g) =>
      g.projects.some((p) => p.id === over.id)
    );
    if (
      fromGroup &&
      toGroup &&
      fromGroup.id === toGroup.id &&
      active.id !== over.id
    ) {
      const oldIndex = fromGroup.projects.findIndex((p) => p.id === active.id);
      const newIndex = fromGroup.projects.findIndex((p) => p.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(fromGroup.projects, oldIndex, newIndex);
        const next = groups.map((g) =>
          g.id === fromGroup.id ? { ...g, projects: reordered } : g
        );
        setGroups(next);
        groupsRef.current = next;
      }
    }

    // Persist either way — within or across section moves.
    persistProjectOrder();
  };

  // ── Tile-level mutations ────────────────────────────────────────────
  const projectsResizeCommitGroup = (id: string) => {
    if (resizeSaveTimer.current) clearTimeout(resizeSaveTimer.current);
    resizeSaveTimer.current = setTimeout(() => {
      const project = groupsRef.current
        .flatMap((g) => g.projects)
        .find((p) => p.id === id);
      if (!project) return;
      void fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          colSpan: project.colSpan,
          rowSpan: project.rowSpan,
        }),
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const handleProjectResize = (id: string, c: number, r: number) =>
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.map((p) =>
          p.id === id ? { ...p, colSpan: c, rowSpan: r } : p
        ),
      }))
    );

  const handleProjectDelete = async (id: string) => {
    const snapshot = groups;
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.filter((p) => p.id !== id),
      }))
    );
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) setGroups(snapshot);
    } catch {
      setGroups(snapshot);
    }
  };

  // ── Section-level mutations ─────────────────────────────────────────
  const handleSectionRename = async (groupId: string, name: string) => {
    setGroups((cur) =>
      cur.map((g) => (g.id === groupId ? { ...g, name } : g))
    );
    await fetch(`/api/groups/${groupId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
  };

  const handleSectionDelete = async (groupId: string) => {
    const snapshot = groups;
    setGroups((cur) => cur.filter((g) => g.id !== groupId));
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) setGroups(snapshot);
      else router.refresh();
    } catch {
      setGroups(snapshot);
    }
  };

  const handleSectionCreate = async () => {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Untitled" }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as {
      id: string;
      slug: string;
      name: string;
      order: number;
    };
    const newGroup: GalleryGroup = { ...created, projects: [] };
    setGroups((cur) => [...cur, newGroup]);
  };

  // ── Render ──────────────────────────────────────────────────────────
  const allProjects = groups.flatMap((g) => g.projects);
  if (allProjects.length === 0 && !editable) {
    return (
      <div
        className="animate-fade-rise rounded-[8px] border border-border bg-content px-6 py-16 text-center"
        style={{ ["--reveal-delay" as string]: "200ms" }}
      >
        <p className="text-[13px] text-muted">No projects yet.</p>
      </div>
    );
  }

  if (!editable) {
    return (
      <div className="flex flex-col gap-12">
        {groups.map((g, gi) => (
          // First section gets eager-loaded first row (above the fold);
          // every other section lazy-loads to keep the network sane.
          <VisitorGallerySection key={g.id} group={g} prioritizeFirstRow={gi === 0} />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      // Stable id stops dnd-kit's internal aria-describedby counter from
      // drifting between SSR and client mount (which would otherwise cause
      // a hydration warning on every Sortable inside this tree).
      id="gallery-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveKind(null)}
    >
      <SortableContext
        items={groups.map((g) => `section:${g.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-12">
          {groups.map((g) => (
            <GallerySection
              key={g.id}
              group={g}
              onRename={(name) => void handleSectionRename(g.id, name)}
              onDelete={() => void handleSectionDelete(g.id)}
              onProjectDelete={(id) => void handleProjectDelete(id)}
              onProjectResize={handleProjectResize}
              onProjectResizeCommit={projectsResizeCommitGroup}
            />
          ))}
        </div>
      </SortableContext>
      <button
        type="button"
        onClick={() => void handleSectionCreate()}
        className="mt-12 inline-flex items-center gap-1.5 self-start rounded-[6px] border border-dashed border-border bg-transparent px-3 py-2 text-[12px] text-muted transition-colors hover:border-fg hover:text-fg"
      >
        <Plus size={12} weight="bold" aria-hidden />
        New section
      </button>
    </DndContext>
  );
}
