"use client";

import Image from "next/image";
import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CornersOut,
  DotsSixVertical,
  Image as ImageIcon,
  Lock,
  Play,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { HeroVideo } from "@/components/hero-video";
import { isVideoUrl } from "@/lib/media";
import type { GalleryProject } from "@/components/gallery-types";

// Sizes hint for the bento grid: ≥640px = at most half the 1280px content
// area (one column out of two), below = roughly the viewport. Drives
// Next/Image's srcset so we don't ship 2MB PNGs at 512px on-screen.
const HERO_SIZES = "(min-width: 640px) 50vw, 100vw";

type CommonProps = {
  project: GalleryProject;
  /** Classes applied to the outer grid cell — usually col/row-span. */
  spanClass: string;
  /** Optional fade-in delay (ms) to stagger reveal animations. */
  revealDelayMs?: number;
  /** Skip lazy loading + emit a preload for tiles above the fold. */
  priority?: boolean;
};

/** Visitor card — pure media, not interactive. */
export function GalleryCard({
  project,
  spanClass,
  revealDelayMs,
  priority,
}: CommonProps) {
  const style: React.CSSProperties | undefined =
    revealDelayMs !== undefined
      ? ({ ["--reveal-delay" as string]: `${revealDelayMs}ms` } as React.CSSProperties)
      : undefined;
  return (
    <div className={`relative ${spanClass}`} style={style}>
      <CardShell>
        <HeroFrame
          url={project.heroImageUrl}
          posterUrl={project.posterUrl}
          hasAudio={project.hasAudio}
          title={project.title}
          protected={project.isProtected}
          priority={priority}
        />
      </CardShell>
    </div>
  );
}

type OwnerProps = CommonProps & {
  onDelete: () => void;
  /** Live size update while the user is dragging the resize handle. */
  onResize: (colSpan: number, rowSpan: number) => void;
  /** Persist the current size to the server (called on pointer release). */
  onResizeCommit: () => void;
  /** Flip the per-tile "has audio worth surfacing" flag. */
  onToggleAudio: () => void;
};

/**
 * Owner card — the entire tile IS the drag handle, and the dnd-kit transform
 * is applied directly to the tile so it moves under the cursor. Hover gives
 * you a drag chip, delete button, and a corner resize handle. The whole
 * card is non-navigable; tiles are pure media on the homepage.
 */
export function SortableGalleryCard({
  project,
  spanClass,
  revealDelayMs,
  priority,
  onDelete,
  onResize,
  onResizeCommit,
  onToggleAudio,
}: OwnerProps) {
  const sortable = useSortable({
    id: project.id,
    data: { kind: "tile" },
  });
  const cellRef = useRef<HTMLDivElement | null>(null);

  const setRefs = (node: HTMLDivElement | null) => {
    cellRef.current = node;
    sortable.setNodeRef(node);
  };

  // Layer multiple transforms: the dnd-kit translation that follows the
  // cursor, plus a small rotate + scale lift while dragging. Composing as
  // a single transform avoids a wrapper element.
  const base = CSS.Transform.toString(sortable.transform) ?? "";
  const lift = sortable.isDragging ? "rotate(-1.4deg) scale(1.04)" : "";
  const composed = [base, lift].filter(Boolean).join(" ");

  const style: React.CSSProperties = {
    transform: composed || undefined,
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 40 : undefined,
    boxShadow: sortable.isDragging
      ? "0 24px 56px -16px rgb(0 0 0 / 0.55)"
      : undefined,
    cursor: sortable.isDragging ? "grabbing" : "grab",
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
    const cellW = rect.width / startCol;
    const cellH = rect.height / startRow;
    const anchorX = rect.right;
    const anchorY = rect.bottom;

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - anchorX;
      const dy = ev.clientY - anchorY;
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
      {...sortable.attributes}
      {...sortable.listeners}
      className={`reorder-card group relative select-none ${spanClass}`}
    >
      <CardShell>
        <HeroFrame
          url={project.heroImageUrl}
          posterUrl={project.posterUrl}
          hasAudio={project.hasAudio}
          title={project.title}
          protected={project.isProtected}
          priority={priority}
        />
      </CardShell>

      <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/85 px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
        <DotsSixVertical size={11} weight="bold" aria-hidden />
        Drag
      </span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm(`Remove this tile?`)) return;
          onDelete();
        }}
        aria-label="Remove tile"
        className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-border-soft bg-content/85 text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100"
      >
        <X size={11} weight="bold" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Resize tile"
        onPointerDown={startResize}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="absolute bottom-3 right-3 inline-flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-[4px] border border-border-soft bg-content/85 text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100"
      >
        <CornersOut size={13} weight="bold" aria-hidden />
      </button>
      {/* Audio-enabled toggle — only relevant for video heroes. Pressed
          state (highlighted) means the "Play" CTA + theater modal are
          surfaced to visitors. */}
      {project.heroImageUrl && isVideoUrl(project.heroImageUrl) && (
        <button
          type="button"
          aria-label={project.hasAudio ? "Hide audio CTA" : "Enable audio CTA"}
          aria-pressed={project.hasAudio}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleAudio();
          }}
          className={
            "absolute bottom-3 left-3 inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-border-soft text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100 " +
            (project.hasAudio
              ? "bg-fg/15 text-fg"
              : "bg-content/85")
          }
        >
          <Play
            size={13}
            weight={project.hasAudio ? "fill" : "regular"}
            aria-hidden
          />
        </button>
      )}
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
  posterUrl,
  hasAudio = false,
  title,
  protected: isProtected,
  priority = false,
}: {
  url: string | null;
  posterUrl?: string | null;
  hasAudio?: boolean;
  title: string;
  protected?: boolean;
  priority?: boolean;
}) {
  return (
    <div className="relative aspect-[16/10] flex-1 overflow-hidden rounded-[6px] border border-border bg-hover sm:aspect-auto">
      {url ? (
        isVideoUrl(url) ? (
          // HeroVideo plays on hover on desktop; on touch it shows the
          // poster <img> and the user taps to play.
          <HeroVideo
            src={url}
            posterUrl={posterUrl ?? null}
            ariaLabel={title}
            hasAudio={hasAudio}
          />
        ) : (
          // Next/Image proxies through the Vercel image optimizer so the
          // browser receives a webp/avif scaled to the actual on-screen
          // pixel dimensions instead of the raw multi-MB PNG.
          <Image
            src={url}
            alt={title}
            fill
            sizes={HERO_SIZES}
            priority={priority}
            className="object-cover"
          />
        )
      ) : (
        // Empty hero — soft gradient + title placeholder so a tile without
        // media still reads as a real tile rather than a broken slot.
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
