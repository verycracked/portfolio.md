"use client";

import Link from "next/link";
import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  CornersOut,
  DotsSixVertical,
  Image as ImageIcon,
  Lock,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { isVideoUrl } from "@/lib/media";
import type { GalleryProject } from "@/components/gallery-types";

type CommonProps = {
  project: GalleryProject;
  /** Classes applied to the outer grid cell — usually col/row-span. */
  spanClass: string;
  /** Optional fade-in delay (ms) to stagger reveal animations. */
  revealDelayMs?: number;
};

/**
 * Visitor card — plain `<Link>` wrapping the image/video. No drag, no
 * delete. Used both directly on /(site) for visitors and inside the
 * dnd-kit DragOverlay for the lifted "ghost" while dragging.
 */
export function GalleryCard({ project, spanClass, revealDelayMs }: CommonProps) {
  const style: React.CSSProperties | undefined =
    revealDelayMs !== undefined
      ? ({ ["--reveal-delay" as string]: `${revealDelayMs}ms` } as React.CSSProperties)
      : undefined;
  return (
    <div className={`relative ${spanClass}`} style={style}>
      <Link
        href={`/projects/${project.slug}`}
        aria-label={project.title}
        className="group block h-full"
      >
        <CardShell>
          <HeroFrame
            url={project.heroImageUrl}
            title={project.title}
            protected={project.isProtected}
          />
        </CardShell>
      </Link>
    </div>
  );
}

type OwnerProps = CommonProps & {
  onDelete: () => void;
  /** Live size update while the user is dragging the resize handle. */
  onResize: (colSpan: number, rowSpan: number) => void;
  /** Persist the current size to the server (called on pointer release). */
  onResizeCommit: () => void;
};

/**
 * Owner card — wraps the visual card in a dnd-kit `useSortable` and adds
 * hover affordances (drag chip, delete button, resize handle). The
 * sortable node *is* the grid cell so dnd-kit's per-card transform
 * reorders the visual layout, not an inner wrapper. Must be rendered
 * inside a `<SortableContext>`.
 */
export function SortableGalleryCard({
  project,
  spanClass,
  revealDelayMs,
  onDelete,
  onResize,
  onResizeCommit,
}: OwnerProps) {
  const sortable = useSortable({ id: project.id });
  const cellRef = useRef<HTMLDivElement | null>(null);

  const setRefs = (node: HTMLDivElement | null) => {
    cellRef.current = node;
    sortable.setNodeRef(node);
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 40 : undefined,
  };
  if (revealDelayMs !== undefined) {
    (style as Record<string, string>)["--reveal-delay"] = `${revealDelayMs}ms`;
  }

  // Pointer-drag resize. Snaps to 1x1 / 2x1 / 1x2 / 2x2 based on how far
  // the pointer has moved relative to a single cell's size. Live updates
  // the span via onResize; saves once on pointerup via onResizeCommit.
  const startResize = (e: React.PointerEvent) => {
    if (!cellRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

    const node = cellRef.current;
    const rect = node.getBoundingClientRect();
    const startCol = project.colSpan;
    const startRow = project.rowSpan;
    // Width/height of a single grid cell, inferred from the current rect.
    const cellW = rect.width / startCol;
    const cellH = rect.height / startRow;
    // Anchor at the bottom-right corner of the tile at gesture start.
    const anchorX = rect.right;
    const anchorY = rect.bottom;

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - anchorX;
      const dy = ev.clientY - anchorY;
      // 40% threshold to flip — gives a nice "snap" feel without being
      // too sticky on the way back.
      const nextCol =
        startCol === 1 && dx > cellW * 0.4
          ? 2
          : startCol === 2 && dx < -cellW * 0.4
            ? 1
            : startCol;
      const nextRow =
        startRow === 1 && dy > cellH * 0.4
          ? 2
          : startRow === 2 && dy < -cellH * 0.4
            ? 1
            : startRow;
      if (nextCol !== project.colSpan || nextRow !== project.rowSpan) {
        onResize(nextCol, nextRow);
      }
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      onResizeCommit();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      ref={setRefs}
      style={style}
      data-dragging={sortable.isDragging ? "1" : undefined}
      className={`reorder-card group relative ${spanClass}`}
    >
      <Link
        href={`/projects/${project.slug}`}
        aria-label={project.title}
        className="block h-full cursor-grab select-none active:cursor-grabbing"
        {...sortable.attributes}
        {...sortable.listeners}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        <CardShell>
          <HeroFrame
            url={project.heroImageUrl}
            title={project.title}
            protected={project.isProtected}
          />
        </CardShell>
      </Link>
      <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/85 px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
        <DotsSixVertical size={11} weight="bold" aria-hidden />
        Drag
      </span>
      <span className="pointer-events-none absolute right-12 top-3 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/85 px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
        Open
        <ArrowUpRight weight="fill" size={10} aria-hidden />
      </span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (
            !confirm(`Remove "${project.title}"? This deletes the tile.`)
          ) {
            return;
          }
          onDelete();
        }}
        aria-label={`Remove ${project.title}`}
        className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-border-soft bg-content/85 text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100"
      >
        <X size={11} weight="bold" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Resize ${project.title}`}
        onPointerDown={startResize}
        onClick={(e) => {
          // Don't let a stray click bubble into the Link nav.
          e.preventDefault();
          e.stopPropagation();
        }}
        className="absolute bottom-3 right-3 inline-flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-[4px] border border-border-soft bg-content/85 text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100"
      >
        <CornersOut size={13} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

/* Outer card shell — the static frame around the hero image / video. */
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="double-stroke flex h-full flex-col overflow-hidden rounded-[8px] bg-hover">
      <div className="relative z-[1] flex flex-1 flex-col gap-1 p-1">
        {children}
      </div>
    </div>
  );
}

function HeroFrame({
  url,
  title,
  protected: isProtected,
}: {
  url: string | null;
  title: string;
  protected?: boolean;
}) {
  return (
    <div className="relative aspect-[16/10] flex-1 overflow-hidden rounded-[6px] border border-border bg-hover sm:aspect-auto">
      {url ? (
        isVideoUrl(url) ? (
          <video
            src={url}
            aria-label={title}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            loading="lazy"
            onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
            className="img-fade h-full w-full object-cover"
          />
        )
      ) : (
        // Empty hero — a soft gradient + the project title so the slot
        // still reads as a real card during drag and at rest, rather than
        // looking like a broken placeholder.
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-hover via-content to-hover px-4 text-center text-muted">
          <ImageIcon size={20} weight="bold" aria-hidden />
          <p className="line-clamp-2 text-[13px] font-medium text-fg">
            {title || "Untitled"}
          </p>
        </div>
      )}
      {isProtected && (
        <span
          aria-label="Protected"
          title="Password protected"
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/95 px-2 py-0.5 text-[11px] text-muted"
        >
          <Lock weight="fill" size={11} aria-hidden />
          Locked
        </span>
      )}
    </div>
  );
}
