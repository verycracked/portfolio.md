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
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import {
  GalleryCard,
  SortableGalleryCard,
} from "@/components/gallery-card";
import { NewTile } from "@/components/new-tile";
import { spanStyle, type GalleryProject } from "@/components/gallery-types";
import { uploadMedia } from "@/lib/media-utils";

const SAVE_DEBOUNCE_MS = 350;

/**
 * Single-bento gallery scoped to one parent project's children. Mirrors
 * the homepage `<Gallery>` for the inner grid behavior — drag-reorder,
 * resize, hover-play, audio toggle, hover-delete — but without the
 * section / group machinery (sub-projects don't belong to sections).
 *
 * `parentId` flows into the reorder endpoint so the order writes update
 * `parentId + order` atomically, and into the inline upload tile so any
 * dropped media auto-becomes a child of the parent.
 */
export function ChildGallery({
  parentId,
  initial,
  owner,
  previewing = false,
}: {
  parentId: string;
  initial: GalleryProject[];
  owner: boolean;
  previewing?: boolean;
}) {
  const router = useRouter();
  const editable = owner && !previewing;
  const [projects, setProjects] = useState<GalleryProject[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 4px activation distance so a real click still navigates the underlying
  // link/handler on a tile with children, while any meaningful drag still
  // starts the gesture.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  useEffect(() => setProjects(initial), [initial]);

  // Ref mirror for debounced persists so the network call always reads the
  // current state instead of a stale closure capture.
  const projectsRef = useRef<GalleryProject[]>(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const reorderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
    },
    []
  );

  const persistOrder = () => {
    if (reorderTimer.current) clearTimeout(reorderTimer.current);
    reorderTimer.current = setTimeout(() => {
      const payload = {
        parentId,
        childIds: projectsRef.current.map((p) => p.id),
      };
      void fetch("/api/projects/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(projects, oldIndex, newIndex);
    setProjects(next);
    persistOrder();
  };

  const handleResize = (id: string, c: number, r: number) =>
    setProjects((cur) =>
      cur.map((p) => (p.id === id ? { ...p, colSpan: c, rowSpan: r } : p))
    );

  const handleResizeCommit = (id: string) => {
    if (resizeTimer.current) clearTimeout(resizeTimer.current);
    resizeTimer.current = setTimeout(() => {
      const project = projectsRef.current.find((p) => p.id === id);
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

  const handleDelete = async (id: string) => {
    const snapshot = projects;
    setProjects((cur) => cur.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) setProjects(snapshot);
      else router.refresh();
    } catch {
      setProjects(snapshot);
    }
  };

  const handleToggleAudio = async (id: string) => {
    const project = projectsRef.current.find((p) => p.id === id);
    if (!project) return;
    const next = !project.hasAudio;
    setProjects((cur) =>
      cur.map((p) => (p.id === id ? { ...p, hasAudio: next } : p))
    );
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hasAudio: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setProjects((cur) =>
        cur.map((p) => (p.id === id ? { ...p, hasAudio: !next } : p))
      );
    }
  };

  const handleReplaceCover = async (id: string, file: File) => {
    const uploaded = await uploadMedia(file);
    if (!uploaded) {
      alert(`Couldn't upload ${file.name}`);
      return;
    }
    setProjects((cur) =>
      cur.map((p) =>
        p.id === id
          ? { ...p, heroImageUrl: uploaded.url, posterUrl: uploaded.posterUrl }
          : p
      )
    );
    void fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        heroImageUrl: uploaded.url,
        posterUrl: uploaded.posterUrl,
      }),
    });
  };

  const handlePromote = async (id: string, title: string) => {
    const snapshot = projects;
    setProjects((cur) =>
      cur.map((p) => (p.id === id ? { ...p, isOpenable: true, title } : p))
    );
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isOpenable: true, title, slug: title }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as { slug?: string };
      if (updated.slug) {
        setProjects((cur) =>
          cur.map((p) => (p.id === id ? { ...p, slug: updated.slug! } : p))
        );
      }
    } catch {
      setProjects(snapshot);
    }
  };

  // Visitor view — static grid, no chrome.
  if (!editable) {
    if (projects.length === 0) return null;
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:auto-rows-[80px] sm:grid-flow-row-dense">
        {projects.map((p, i) => (
          <GalleryCard
            key={p.id}
            project={p}
            spanClass="animate-fade-rise"
            spanStyle={spanStyle(p.colSpan, p.rowSpan)}
            revealDelayMs={i * 60}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      id="child-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex flex-col gap-3">
        {/* Owner-only upload affordance — used to live as a card at
            the end of the grid, now floats above so the bento stays
            uniform and gap-free. */}
        <div className="flex justify-end">
          <NewTile parentId={parentId} />
        </div>
        <SortableContext
          items={projects.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div
            data-reordering={activeId ? "1" : undefined}
            className="reorder-grid grid grid-cols-1 gap-3 sm:grid-cols-12 sm:auto-rows-[80px] sm:grid-flow-row-dense"
          >
            {projects.map((p, i) => (
              <SortableGalleryCard
                key={p.id}
                project={p}
                onDelete={() => void handleDelete(p.id)}
                onResize={(c, r) => handleResize(p.id, c, r)}
                onResizeCommit={() => handleResizeCommit(p.id)}
                onToggleAudio={() => void handleToggleAudio(p.id)}
                onPromote={(title) => void handlePromote(p.id, title)}
                onReplaceCover={(file) => void handleReplaceCover(p.id, file)}
                spanClass="animate-fade-rise"
                spanStyle={spanStyle(p.colSpan, p.rowSpan)}
                revealDelayMs={i * 60}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </DndContext>
  );
}
