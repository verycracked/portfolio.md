"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  CornersOut,
  DotsSixVertical,
  Folder,
  Image as ImageIcon,
  Lock,
  Play,
  UploadSimple,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { HeroVideo } from "@/components/hero-video";
import { SkeletonImage } from "@/components/skeleton-image";
import { MEDIA_ACCEPT, isVideoUrl } from "@/lib/media";
import { usePreviewing, withPreview } from "@/lib/preview";
import { MAX_SPAN, type GalleryProject } from "@/components/gallery-types";

// Sizes hint for the bento grid: ≥640px = at most half the 1280px content
// area (one column out of two), below = roughly the viewport. Drives
// Next/Image's srcset so we don't ship 2MB PNGs at 512px on-screen.
const HERO_SIZES = "(min-width: 640px) 50vw, 100vw";

type CommonProps = {
  project: GalleryProject;
  /** Optional classes applied to the outer grid cell (animate-fade-rise
   *  etc.). Sizing comes from `spanStyle`, not from a class. */
  spanClass?: string;
  /** Inline grid-column / grid-row spans for this tile. Drives the
   *  free-form bento sizing. */
  spanStyle?: React.CSSProperties;
  /** Optional fade-in delay (ms) to stagger reveal animations. */
  revealDelayMs?: number;
  /** Skip lazy loading + emit a preload for tiles above the fold. */
  priority?: boolean;
  /** When true, the tile body never wraps in a Link and the owner-mode
   *  click handler doesn't router.push. Used in view editors where the
   *  per-view slug doesn't resolve to a canonical /projects/[slug] page. */
  disableLinks?: boolean;
};

/**
 * Visitor card — pure media at rest. Becomes a `<Link>` when the project
 * has at least one sub-project; click-through opens the parent's detail
 * page. Tiles without children stay non-interactive (matches the calm
 * tile-only vibe of the homepage).
 */
export function GalleryCard({
  project,
  spanClass = "",
  spanStyle,
  revealDelayMs,
  priority,
  disableLinks = false,
}: CommonProps) {
  // Merge the reveal-delay CSS var (when supplied) into the same style
  // object so we only spread one prop onto the outer element.
  const style: React.CSSProperties | undefined = (() => {
    const base = spanStyle ? { ...spanStyle } : undefined;
    if (revealDelayMs === undefined) return base;
    return {
      ...(base ?? {}),
      ["--reveal-delay" as string]: `${revealDelayMs}ms`,
    } as React.CSSProperties;
  })();
  // A tile is clickable when it has children OR the owner explicitly
  // opted in to a detail page (e.g. a stand-alone project with a
  // meaningful write-up but no sub-projects).
  const clickable = (project.childCount > 0 || project.isOpenable) && !disableLinks;
  const previewing = usePreviewing();

  const body = (
    <CardShell>
      <HeroFrame
        url={project.heroImageUrl}
        posterUrl={project.posterUrl}
        hasAudio={project.hasAudio}
        title={project.title}
        protected={project.isProtected}
        priority={priority}
        // When the tile is clickable, surface an Open CTA on hover using
        // the same diffusion-blur treatment as the Play CTA.
        openOverlay={clickable}
      />
    </CardShell>
  );

  if (clickable) {
    return (
      <Link
        href={withPreview(`/projects/${project.slug}`, previewing)}
        aria-label={`Open ${project.title}`}
        className={`group/tile relative block ${spanClass}`}
        style={style}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={`relative ${spanClass}`} style={style}>
      {body}
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
  /** Promote a media tile to a project — sets isOpenable=true and stores
   *  the new title. Once promoted, a tile can't be demoted from the chip
   *  (button is disabled); deleting the row is the way out. */
  onPromote: (title: string) => void;
  /** Swap the cover for an uploaded file. Caller handles the upload +
   *  poster extraction + PUT. */
  onReplaceCover: (file: File) => void;
};

/**
 * Owner card — the entire tile IS the drag handle, and the dnd-kit transform
 * is applied directly to the tile so it moves under the cursor. Hover gives
 * you a drag chip, delete button, and a corner resize handle. The whole
 * card is non-navigable; tiles are pure media on the homepage.
 */
export function SortableGalleryCard({
  project,
  spanClass = "",
  spanStyle,
  revealDelayMs,
  priority,
  disableLinks = false,
  onDelete,
  onResize,
  onResizeCommit,
  onToggleAudio,
  onPromote,
  onReplaceCover,
}: OwnerProps) {
  const sortable = useSortable({
    id: project.id,
    data: { kind: "tile" },
  });
  const cellRef = useRef<HTMLDivElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const previewing = usePreviewing();
  const clickable = (project.childCount > 0 || project.isOpenable) && !disableLinks;
  // Inline rename UX — the ↗ chip below opens this overlay; the user
  // names the tile and on submit we promote it to a project.
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  const promotedAlready = project.isOpenable || project.childCount > 0;
  const startRename = () => {
    // Always allow opening — pre-fills with current title so the user can
    // rename an existing project, not just promote a fresh media tile.
    setDraft(project.title || "");
    setRenaming(true);
  };
  const submitRename = () => {
    const name = draft.trim();
    setRenaming(false);
    if (!name) return; // empty → cancel
    onPromote(name);
  };
  const cancelRename = () => {
    setRenaming(false);
  };

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
    ...(spanStyle ?? {}),
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
    // Width/height of a single column / row track. The card currently
    // spans startCol columns and startRow rows, so divide to recover
    // the per-cell footprint. Gaps between tracks are folded into the
    // per-cell math here (small bias) and the snap threshold is loose
    // enough that the difference doesn't matter in practice.
    const cellW = rect.width / startCol;
    const cellH = rect.height / startRow;
    const anchorX = e.clientX;
    const anchorY = e.clientY;

    const handleMove = (mv: PointerEvent) => {
      const dx = mv.clientX - anchorX;
      const dy = mv.clientY - anchorY;
      // Continuous snap: every full cell of drag distance bumps the
      // span by one. `Math.round` gives a half-cell hysteresis on each
      // side so a tile doesn't flicker between sizes on tiny pointer
      // jitter.
      const nextCol = Math.max(
        1,
        Math.min(MAX_SPAN, startCol + Math.round(dx / cellW))
      );
      const nextRow = Math.max(
        1,
        Math.min(MAX_SPAN, startRow + Math.round(dy / cellH))
      );
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
      onClick={(e) => {
        // dnd-kit only fires this when the gesture stayed within the 4px
        // activation distance — i.e. a real click, not a drag. Use it to
        // route into the project detail page for clickable tiles.
        if (!clickable) return;
        const target = e.target as HTMLElement;
        // Skip if the click landed on an interactive chrome button (X /
        // resize / audio / open toggle) — those have their own handlers.
        if (target.closest("button")) return;
        router.push(withPreview(`/projects/${project.slug}`, previewing));
      }}
      className={`reorder-card group relative select-none ${spanClass} ${
        clickable ? "cursor-pointer" : ""
      }`}
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
          replaceInputRef.current?.click();
        }}
        aria-label="Replace cover"
        title="Replace cover"
        className="absolute right-12 top-3 inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-border-soft bg-content/85 text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100"
      >
        <UploadSimple size={11} weight="bold" aria-hidden />
      </button>
      <input
        ref={replaceInputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplaceCover(f);
          e.target.value = "";
        }}
      />
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
      {/* Folder chip — opens an inline name input next to itself. For a
          media tile this promotes it to a project (sets title + isOpenable).
          For an already-promoted project it just renames. Visitors never
          see this chip (owner chrome only). The filled background means
          "already a project," outline means "still a media tile." */}
      {!renaming && (
        <button
          type="button"
          aria-label={
            promotedAlready
              ? "Rename this project"
              : "Promote to a project"
          }
          aria-pressed={promotedAlready}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startRename();
          }}
          title={
            promotedAlready
              ? "Rename this project"
              : "Click to make this a project"
          }
          className={
            "absolute bottom-3 inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-border-soft text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100 " +
            (project.heroImageUrl && isVideoUrl(project.heroImageUrl)
              ? "left-12 "
              : "left-3 ") +
            (promotedAlready
              ? "bg-fg/15 text-fg"
              : "bg-content/85")
          }
        >
          <Folder size={13} weight="fill" aria-hidden />
        </button>
      )}
      {renaming && (
        // Small inline name input — sits where the chip was so the
        // promote interaction stays anchored to the same spot. Enter
        // commits, Esc or blur cancels (empty value also cancels).
        <input
          ref={renameInputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Name…"
          autoFocus
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitRename();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelRename();
            }
          }}
          onBlur={submitRename}
          className={
            "absolute bottom-3 z-30 h-7 w-[160px] rounded-[4px] border border-border bg-content/95 px-2 text-[12px] text-fg shadow-[0_4px_12px_-4px_rgb(0_0_0_/_0.4)] outline-none placeholder:text-tertiary backdrop-blur focus:border-fg " +
            (project.heroImageUrl && isVideoUrl(project.heroImageUrl)
              ? "left-12"
              : "left-3")
          }
        />
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
  openOverlay = false,
}: {
  url: string | null;
  posterUrl?: string | null;
  hasAudio?: boolean;
  title: string;
  protected?: boolean;
  priority?: boolean;
  /** Surface the "Open ↗" hover overlay (used when the tile is a clickable
   *  parent project on the homepage). */
  openOverlay?: boolean;
}) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-[6px] border border-border bg-hover">
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
          <SkeletonImage
            src={url}
            alt={title}
            fill
            sizes={HERO_SIZES}
            priority={priority}
            // Skip the WebP/AVIF transcode — for UI screenshots even q=92
            // softens text + edges visibly. Serve the raw PNG/JPEG so the
            // gallery stays pixel-perfect at the cost of a heavier payload.
            unoptimized
            className={
              "object-cover transition-[filter] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (openOverlay ? "group-hover/tile:blur-[3px]" : "")
            }
          />
        )
      ) : (
        // Empty hero — soft gradient + icon. Title only renders when this
        // tile has actually been promoted to a project; media tiles
        // (empty title) stay anonymous.
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-hover via-content to-hover px-4 text-center text-muted">
          <ImageIcon size={20} weight="bold" aria-hidden />
          {title && (
            <p className="line-clamp-2 text-[13px] font-medium text-fg">
              {title}
            </p>
          )}
        </div>
      )}
      {openOverlay && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[5] opacity-0 transition-opacity duration-300 ease-out group-hover/tile:opacity-100"
            style={{
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              maskImage:
                "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0) 90%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0) 90%)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 inline-flex max-w-[80%] -translate-x-1/2 -translate-y-1/2 items-center gap-2 px-4 text-center text-[15px] font-medium text-white opacity-0 drop-shadow-[0_2px_10px_rgb(0_0_0_/_0.55)] transition-opacity duration-300 ease-out group-hover/tile:opacity-100"
          >
            {/* If the tile has a name, show it on hover; otherwise fall
                back to the generic "Open" verb. Either way the ↗ icon
                tags the action as a link to a detail page. */}
            <span className="line-clamp-2">{title?.trim() || "Open"}</span>
            <ArrowUpRight
              size={16}
              weight="bold"
              className="shrink-0"
            />
          </span>
        </>
      )}
      {isProtected && (
        <span
          aria-label="Protected"
          title="Password protected"
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/95 px-2 py-0.5 text-[11px] text-muted"
        >
          <Lock weight="fill" size={11} aria-hidden />
          Locked
        </span>
      )}
    </div>
  );
}
