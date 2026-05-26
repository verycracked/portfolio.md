"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
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
import { spanClass, type GalleryProject } from "@/components/gallery-types";

// Debounce window before pushing a reorder to the server. Keeps rapid
// gestures (drop, immediately drag again) from spamming the API.
const REORDER_SAVE_DEBOUNCE_MS = 350;

/**
 * Project gallery grid. Visitors see a static bento layout; owners get
 * dnd-kit-powered reorder, hover-X delete, and a "+ Upload" tile at the
 * end of the grid. Persists order via POST /api/projects/reorder.
 */
export function Gallery({
  initial,
  owner,
  previewing = false,
}: {
  initial: GalleryProject[];
  owner: boolean;
  previewing?: boolean;
}) {
  const editable = owner && !previewing;
  const [projects, setProjects] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PointerSensor with a small activation distance so plain clicks (without
  // movement) still navigate the underlying Link. Anything past 6px reads as
  // a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  // Re-sync when server data refreshes (e.g. after upload + router.refresh).
  useEffect(() => {
    setProjects(initial);
  }, [initial]);

  const persistOrder = (next: GalleryProject[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch("/api/projects/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      });
    }, REORDER_SAVE_DEBOUNCE_MS);
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
    persistOrder(next);
  };

  const handleDelete = async (id: string) => {
    const snapshot = projects;
    setProjects((cur) => cur.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) setProjects(snapshot);
    } catch {
      setProjects(snapshot);
    }
  };

  if (projects.length === 0 && !editable) {
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:auto-rows-[260px]">
        {projects.map((p, i) => (
          <div
            key={p.id}
            className="animate-fade-rise"
            style={{ ["--reveal-delay" as string]: `${200 + i * 60}ms` }}
          >
            <GalleryCard
              project={p}
              spanClass={spanClass(p.colSpan, p.rowSpan)}
            />
          </div>
        ))}
      </div>
    );
  }

  const activeProject = projects.find((p) => p.id === activeId) ?? null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext
        items={projects.map((p) => p.id)}
        strategy={rectSortingStrategy}
      >
        <div
          data-reordering={activeId ? "1" : undefined}
          className="reorder-grid grid grid-cols-1 gap-6 sm:grid-cols-2 sm:auto-rows-[260px]"
        >
          {projects.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-rise"
              style={{ ["--reveal-delay" as string]: `${200 + i * 60}ms` }}
            >
              <SortableGalleryCard
                project={p}
                onDelete={() => void handleDelete(p.id)}
                spanClass={spanClass(p.colSpan, p.rowSpan)}
              />
            </div>
          ))}
          <div
            className="animate-fade-rise"
            style={{
              ["--reveal-delay" as string]: `${200 + projects.length * 60}ms`,
            }}
          >
            <NewTile />
          </div>
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null} adjustScale={false}>
        {activeProject ? (
          <div
            className="pointer-events-none"
            style={{
              transform: "rotate(-1.2deg) scale(1.04)",
              boxShadow: "0 24px 56px -16px rgb(0 0 0 / 0.55)",
            }}
          >
            <GalleryCard
              project={activeProject}
              spanClass={spanClass(activeProject.colSpan, activeProject.rowSpan)}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
