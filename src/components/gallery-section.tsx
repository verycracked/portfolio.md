"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { DotsSixVertical, Trash } from "@phosphor-icons/react/dist/ssr";
import {
  GalleryCard,
  SortableGalleryCard,
} from "@/components/gallery-card";
import { NewTile } from "@/components/new-tile";
import { spanClass, type GalleryGroup } from "@/components/gallery-types";

type CommonProps = {
  group: GalleryGroup;
};

type VisitorProps = CommonProps & {
  /** When true, the first two tiles in this section preload eagerly
   *  (used for the first/above-the-fold section to improve LCP). */
  prioritizeFirstRow?: boolean;
};

type OwnerProps = CommonProps & {
  onRename: (name: string) => void;
  onDelete: () => void;
  onProjectDelete: (id: string) => void;
  onProjectResize: (id: string, c: number, r: number) => void;
  onProjectResizeCommit: (id: string) => void;
  onProjectToggleAudio: (id: string) => void;
  onProjectPromote: (id: string, title: string) => void;
  onProjectReplaceCover: (id: string, file: File) => void;
};

/**
 * Owner-facing section: rename header, sortable grid of tiles, + tile at
 * the end, and the section itself participates in vertical drag-reorder
 * with its sibling sections. The header is the section's drag handle.
 */
export function GallerySection({
  group,
  onRename,
  onDelete,
  onProjectDelete,
  onProjectResize,
  onProjectResizeCommit,
  onProjectToggleAudio,
  onProjectPromote,
  onProjectReplaceCover,
}: OwnerProps) {
  // The section as a whole is sortable (header is the drag handle).
  const sortable = useSortable({
    id: `section:${group.id}`,
    data: { kind: "section", groupId: group.id },
  });
  // And the grid is a droppable target so empty sections still accept tiles.
  const droppable = useDroppable({
    id: `dropzone:${group.id}`,
    data: { kind: "section-dropzone", groupId: group.id },
  });

  const setSortRef = (node: HTMLDivElement | null) => {
    sortable.setNodeRef(node);
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 30 : undefined,
    opacity: sortable.isDragging ? 0.85 : undefined,
  };

  return (
    <section ref={setSortRef} style={style} className="flex flex-col gap-4">
      <SectionHeader
        name={group.name}
        onRename={onRename}
        onDelete={onDelete}
        dragHandleProps={{
          ...sortable.attributes,
          ...sortable.listeners,
        }}
      />
      <SortableContext
        items={group.projects.map((p) => p.id)}
        strategy={rectSortingStrategy}
      >
        <div
          ref={droppable.setNodeRef}
          data-droppable-active={droppable.isOver ? "1" : undefined}
          className={
            "reorder-grid grid grid-cols-1 gap-6 sm:grid-cols-2  " +
            (droppable.isOver
              ? "rounded-[8px] ring-2 ring-fg/40 ring-offset-2 ring-offset-bg"
              : "")
          }
        >
          {group.projects.map((p) => (
            <SortableGalleryCard
              key={p.id}
              project={p}
              onDelete={() => onProjectDelete(p.id)}
              onResize={(c, r) => onProjectResize(p.id, c, r)}
              onResizeCommit={() => onProjectResizeCommit(p.id)}
              onToggleAudio={() => onProjectToggleAudio(p.id)}
              onPromote={(title) => onProjectPromote(p.id, title)}
              onReplaceCover={(file) => onProjectReplaceCover(p.id, file)}
              spanClass={spanClass(p.colSpan, p.rowSpan)}
            />
          ))}
          <NewTile groupId={group.id} />
        </div>
      </SortableContext>
    </section>
  );
}

/** Read-only section for visitors: just the header and a static grid. */
export function VisitorGallerySection({
  group,
  prioritizeFirstRow = false,
}: VisitorProps) {
  if (group.projects.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-border-soft pb-2 text-[13px] font-medium tracking-tight text-muted">
        {group.name}
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 ">
        {group.projects.map((p, i) => (
          <GalleryCard
            key={p.id}
            project={p}
            spanClass={spanClass(p.colSpan, p.rowSpan)}
            priority={prioritizeFirstRow && i < 2}
          />
        ))}
      </div>
    </section>
  );
}

/* Editable header with a click-to-rename input, drag handle, and delete. */
function SectionHeader({
  name,
  onRename,
  onDelete,
  dragHandleProps,
}: {
  name: string;
  onRename: (name: string) => void;
  onDelete: () => void;
  dragHandleProps: Record<string, unknown>;
}) {
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || "Untitled";
    setEditing(false);
    if (next !== name) onRename(next);
    setDraft(next);
  };

  return (
    <div className="group/header relative flex items-center gap-2 border-b border-border-soft pb-2">
      {/* Drag handle floats outside the header flow so the title can sit
          flush to the left edge of the section. Shows on hover only. */}
      <button
        type="button"
        aria-label="Drag section"
        className="absolute -left-6 top-1/2 -mt-3 inline-flex h-6 w-5 cursor-grab items-center justify-center text-tertiary opacity-0 transition-opacity active:cursor-grabbing group-hover/header:opacity-100"
        {...dragHandleProps}
      >
        <DotsSixVertical size={14} weight="bold" aria-hidden />
      </button>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="flex-1 bg-transparent text-[13px] font-medium tracking-tight text-muted outline-none"
          spellCheck={false}
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="-mx-1 flex-1 rounded-[4px] px-1 text-left text-[13px] font-medium tracking-tight text-muted hover:bg-hover hover:text-fg"
        >
          {name}
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (
            !confirm(
              `Delete section "${name}" and all of its tiles? This cannot be undone.`
            )
          ) {
            return;
          }
          onDelete();
        }}
        aria-label="Delete section"
        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-tertiary opacity-0 transition-[opacity,color] hover:text-rose-400 group-hover/header:opacity-100"
      >
        <Trash size={12} weight="bold" aria-hidden />
      </button>
    </div>
  );
}
