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
  TileLink,
} from "@/components/gallery-types";
import { uploadMedia } from "@/lib/media-utils";
import { slugify } from "@/lib/slug";
import {
  groupUrl,
  groupsBase,
  groupsReorder,
  projectUrl,
  projectsReorder,
  type GalleryScope,
  MAIN_SCOPE,
} from "@/lib/gallery-scope";

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
  scope = MAIN_SCOPE,
}: {
  initial: GalleryGroup[];
  owner: boolean;
  previewing?: boolean;
  /** Routes every read/write to the right API: main page (default) or a
   *  per-view editor. Same shape on both endpoints. */
  scope?: GalleryScope;
  /** True in the view editor: tile slugs are view-scoped, not canonical
   *  Project slugs, so we suppress every "/projects/[slug]" link. */
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
      void fetch(projectsReorder(scope), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const persistGroupOrder = () => {
    void fetch(groupsReorder(scope), {
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
      void fetch(projectUrl(scope, id), {
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

  const handleToggleAudio = async (id: string) => {
    const project = groupsRef.current
      .flatMap((g) => g.projects)
      .find((p) => p.id === id);
    if (!project) return;
    const next = !project.hasAudio;
    // Optimistic flip — roll back on server error.
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.map((p) =>
          p.id === id ? { ...p, hasAudio: next } : p
        ),
      }))
    );
    try {
      const res = await fetch(projectUrl(scope, id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hasAudio: next }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
    } catch {
      setGroups((cur) =>
        cur.map((g) => ({
          ...g,
          projects: g.projects.map((p) =>
            p.id === id ? { ...p, hasAudio: !next } : p
          ),
        }))
      );
    }
  };

  const handleLinkChange = async (id: string, links: TileLink[]) => {
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.map((p) =>
          p.id === id ? { ...p, links } : p
        ),
      }))
    );
    await fetch(projectUrl(scope, id), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ links }),
    });
  };

  const handleFullVideoChange = async (id: string, file: File) => {
    let uploaded: { url: string; posterUrl: string | null };
    try {
      uploaded = await uploadMedia(file);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Couldn't upload ${file.name}`);
      return;
    }
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.map((p) =>
          p.id === id ? { ...p, fullVideoUrl: uploaded.url } : p
        ),
      }))
    );
    void fetch(projectUrl(scope, id), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullVideoUrl: uploaded.url }),
    });
  };

  const handleReplaceCover = async (id: string, file: File) => {
    // Upload first (poster extracted client-side for videos), then PUT
    // both URLs onto the project. No optimistic update — we don't know
    // the new R2 URL until the upload completes.
    let uploaded: { url: string; posterUrl: string | null };
    try {
      uploaded = await uploadMedia(file);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Couldn't upload ${file.name}`);
      return;
    }
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.map((p) =>
          p.id === id
            ? {
                ...p,
                heroImageUrl: uploaded.url,
                posterUrl: uploaded.posterUrl,
              }
            : p
        ),
      }))
    );
    void fetch(projectUrl(scope, id), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        heroImageUrl: uploaded.url,
        posterUrl: uploaded.posterUrl,
      }),
    });
  };

  /** Flip a promoted project back to "media tile" mode. Title is kept
   *  on the row so the owner can re-promote with the same name later
   *  by clicking the folder chip again. */
  const handleDemote = async (id: string) => {
    const snapshot = groups;
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.map((p) =>
          p.id === id ? { ...p, isOpenable: false } : p
        ),
      }))
    );
    try {
      const res = await fetch(projectUrl(scope, id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isOpenable: false }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
    } catch {
      setGroups(snapshot);
    }
  };

  const handlePromote = async (id: string, title: string) => {
    const snapshot = groups;
    // Optimistic flip — show the new title, the projecty state, AND a
    // best-guess slug immediately so the "Open ↗" button resolves even
    // before the server responds with the canonical slug.
    const optimisticSlug = slugify(title) || undefined;
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.map((p) =>
          p.id === id
            ? {
                ...p,
                isOpenable: true,
                title,
                ...(optimisticSlug ? { slug: optimisticSlug } : {}),
              }
            : p
        ),
      }))
    );
    try {
      const res = await fetch(projectUrl(scope, id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isOpenable: true, title, slug: title }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      // Slug may have been suffixed for collisions; pull the canonical
      // value back into local state so subsequent links work.
      const updated = (await res.json()) as { slug?: string };
      if (updated.slug) {
        setGroups((cur) =>
          cur.map((g) => ({
            ...g,
            projects: g.projects.map((p) =>
              p.id === id ? { ...p, slug: updated.slug! } : p
            ),
          }))
        );
      }
    } catch {
      setGroups(snapshot);
    }
  };

  const handleProjectDelete = async (id: string) => {
    const snapshot = groups;
    setGroups((cur) =>
      cur.map((g) => ({
        ...g,
        projects: g.projects.filter((p) => p.id !== id),
      }))
    );
    try {
      const res = await fetch(projectUrl(scope, id), { method: "DELETE" });
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
    await fetch(groupUrl(scope, groupId), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
  };

  const handleSectionLinkChange = async (groupId: string, linkUrl: string) => {
    setGroups((cur) =>
      cur.map((g) => (g.id === groupId ? { ...g, linkUrl } : g))
    );
    await fetch(groupUrl(scope, groupId), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ linkUrl }),
    });
  };

  const handleSectionDelete = async (groupId: string) => {
    const snapshot = groups;
    setGroups((cur) => cur.filter((g) => g.id !== groupId));
    try {
      const res = await fetch(groupUrl(scope, groupId), { method: "DELETE" });
      if (!res.ok) setGroups(snapshot);
      else router.refresh();
    } catch {
      setGroups(snapshot);
    }
  };

  const handleSectionCreate = async () => {
    const res = await fetch(groupsBase(scope), {
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
          <VisitorGallerySection key={g.id} group={g} scope={scope} prioritizeFirstRow={gi === 0} />
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
              scope={scope}
              onRename={(name) => void handleSectionRename(g.id, name)}
              onLinkChange={(url) => void handleSectionLinkChange(g.id, url)}
              onDelete={() => void handleSectionDelete(g.id)}
              onProjectDelete={(id) => void handleProjectDelete(id)}
              onProjectResize={handleProjectResize}
              onProjectResizeCommit={projectsResizeCommitGroup}
              onProjectToggleAudio={(id) => void handleToggleAudio(id)}
              onProjectPromote={(id, title) => void handlePromote(id, title)}
              onProjectDemote={(id) => void handleDemote(id)}
              onProjectReplaceCover={(id, file) => void handleReplaceCover(id, file)}
              onProjectFullVideoChange={(id, file) => handleFullVideoChange(id, file)}
              onProjectLinkChange={(id, links) => void handleLinkChange(id, links)}
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
