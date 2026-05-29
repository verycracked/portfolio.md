"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  CircleNotch,
  CornersOut,
  DotsSixVertical,
  FilmStrip,
  Folder,
  Image as ImageIcon,
  LinkSimple,
  Lock,
  Play,
  UploadSimple,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { HeroVideo } from "@/components/hero-video";
import { SkeletonImage } from "@/components/skeleton-image";
import { MEDIA_ACCEPT, isVideoUrl } from "@/lib/media";
import { usePreviewing, withPreview } from "@/lib/preview";
import { MAX_SPAN, type GalleryProject, type TileLink } from "@/components/gallery-types";
import { MAIN_SCOPE, type GalleryScope } from "@/lib/gallery-scope";

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
  /** Scope for building tile links — main page routes to /projects/[slug],
   *  view scope routes to /v/[viewSlug]/[projectSlug]. */
  scope?: GalleryScope;
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
  scope = MAIN_SCOPE,
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
  const clickable = project.childCount > 0 || project.isOpenable;
  const previewing = usePreviewing();

  function tileHref(): string {
    if (scope.kind === "view") return `/v/${scope.viewSlug}/${project.slug}`;
    return `/projects/${project.slug}`;
  }

  const body = (
    <CardShell>
      <HeroFrame
        url={project.heroImageUrl}
        posterUrl={project.posterUrl}
        hasAudio={project.hasAudio}
        title={project.title}
        links={project.links}
        fullVideoUrl={project.fullVideoUrl}
        protected={project.isProtected}
        priority={priority}
        openOverlay={clickable}
      />
    </CardShell>
  );

  if (clickable) {
    return (
      <Link
        href={withPreview(tileHref(), previewing)}
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
  /** Scope for URL construction — main page or a specific view. */
  scope?: GalleryScope;
  onDelete: () => void;
  /** Live size update while the user is dragging the resize handle. */
  onResize: (colSpan: number, rowSpan: number) => void;
  /** Persist the current size to the server (called on pointer release). */
  onResizeCommit: () => void;
  /** Flip the per-tile "has audio worth surfacing" flag. */
  onToggleAudio: () => void;
  /** Promote a media tile to a project — sets isOpenable=true and stores
   *  the new title. */
  onPromote: (title: string) => void;
  /** Demote a promoted project back to media-tile state — flips
   *  isOpenable=false. Title is kept so the owner can re-promote with
   *  the same name later. */
  onDemote: () => void;
  /** Swap the cover for an uploaded file. Caller handles the upload +
   *  poster extraction + PUT. */
  onReplaceCover: (file: File) => void | Promise<void>;
  /** Replace the tile's links array (add/remove/reorder). */
  onLinkChange: (links: TileLink[]) => void;
  /** Set the full-length video URL for the theater modal. Returns a
   *  promise so the card can show a loading indicator while uploading. */
  onFullVideoChange: (file: File) => Promise<void>;
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
  scope = MAIN_SCOPE,
  onDelete,
  onResize,
  onResizeCommit,
  onToggleAudio,
  onPromote,
  onDemote,
  onReplaceCover,
  onLinkChange,
  onFullVideoChange,
}: OwnerProps) {
  const sortable = useSortable({
    id: project.id,
    data: { kind: "tile" },
  });
  const cellRef = useRef<HTMLDivElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const fullVideoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const router = useRouter();
  const previewing = usePreviewing();
  const clickable = project.childCount > 0 || project.isOpenable;

  function tileHref(): string {
    if (scope.kind === "view") return `/v/${scope.viewSlug}/${project.slug}`;
    return `/projects/${project.slug}`;
  }

  // Inline rename UX — the ↗ chip below opens this overlay; the user
  // names the tile and on submit we promote it to a project.
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  // Multi-link editing panel — toggled by the chain-link chip.
  const [linksOpen, setLinksOpen] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const addUrlRef = useRef<HTMLInputElement | null>(null);

  const commitAddLink = () => {
    const label = addLabel.trim();
    let url = addUrl.trim();
    if (!label || !url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith("mailto:") && !url.startsWith("/")) {
      url = `https://${url}`;
    }
    onLinkChange([...project.links, { label, url }]);
    setAddLabel("");
    setAddUrl("");
  };
  const removeLink = (idx: number) => {
    onLinkChange(project.links.filter((_, i) => i !== idx));
  };

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
        router.push(withPreview(tileHref(), previewing));
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
          links={project.links}
        fullVideoUrl={project.fullVideoUrl}
          protected={project.isProtected}
          priority={priority}
        />
      </CardShell>

      <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/85 px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
        <DotsSixVertical size={11} weight="bold" aria-hidden />
        Drag
      </span>
      {/* Link chip — opens a small panel to add/remove labeled links. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setLinksOpen((v) => !v);
        }}
        aria-label={project.links.length > 0 ? `${project.links.length} link(s)` : "Add links"}
        title={project.links.length > 0 ? `${project.links.length} link(s)` : "Add links"}
        className={
          "absolute right-[5.25rem] top-3 inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-border-soft transition-[opacity,color] hover:text-fg group-hover:opacity-100 " +
          (project.links.length > 0
            ? "bg-fg/15 text-fg opacity-100"
            : "bg-content/85 text-muted opacity-0")
        }
      >
        <LinkSimple size={11} weight="bold" aria-hidden />
      </button>
      {linksOpen && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute right-3 top-10 z-40 flex w-[260px] flex-col gap-2 rounded-[6px] border border-border bg-content/95 p-3 shadow-[0_8px_24px_-8px_rgb(0_0_0_/_0.5)] backdrop-blur"
        >
          {project.links.map((link, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <span className="truncate font-medium text-fg">{link.label}</span>
              <span className="truncate text-tertiary">{link.url}</span>
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="ml-auto shrink-0 text-tertiary hover:text-rose-400"
                title="Remove"
              >
                <X size={9} weight="bold" aria-hidden />
              </button>
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <input
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="Label (e.g. Visit, GitHub)"
              className="w-full rounded-[4px] border border-border-soft bg-hover px-2 py-1 text-[11px] text-fg outline-none placeholder:text-tertiary focus:border-fg"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrlRef.current?.focus();
                }
              }}
            />
            <input
              ref={addUrlRef}
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-[4px] border border-border-soft bg-hover px-2 py-1 text-[11px] text-fg outline-none placeholder:text-tertiary focus:border-fg"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAddLink();
                }
              }}
            />
            <button
              type="button"
              onClick={commitAddLink}
              disabled={!addLabel.trim() || !addUrl.trim()}
              className="self-end rounded-[4px] border border-border-soft bg-content/80 px-2 py-0.5 text-[10px] text-muted hover:text-fg disabled:opacity-40"
            >
              + Add
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!uploadingCover) replaceInputRef.current?.click();
        }}
        aria-label={uploadingCover ? "Uploading…" : "Replace cover"}
        title={uploadingCover ? "Uploading cover…" : "Replace cover"}
        className={
          "absolute right-12 top-3 inline-flex h-6 items-center justify-center rounded-[4px] border border-border-soft text-muted transition-[opacity,color] hover:text-fg group-hover:opacity-100 " +
          (uploadingCover
            ? "w-auto gap-1 px-2 bg-fg/15 text-fg opacity-100"
            : "w-6 bg-content/85 opacity-0")
        }
      >
        {uploadingCover ? (
          <>
            <CircleNotch size={10} weight="bold" className="animate-spin" aria-hidden />
            <span className="text-[10px]">Uploading…</span>
          </>
        ) : (
          <UploadSimple size={11} weight="bold" aria-hidden />
        )}
      </button>
      <input
        ref={replaceInputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setUploadingCover(true);
            void Promise.resolve(onReplaceCover(f)).finally(() => setUploadingCover(false));
          }
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
      {/* Open project — for promoted tiles. On the main page, links to
          the canonical /projects/[slug]. In a view editor, links to the
          view-scoped /v/[viewSlug]/[projectSlug]. */}
      {promotedAlready && (
        <a
          href={
            scope.kind === "view"
              ? `/v/${scope.viewSlug}/${project.slug}`
              : `/projects/${project.slug}`
          }
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label="Open project"
          title="Open project"
          className="absolute right-3 bottom-12 inline-flex h-6 items-center gap-1 rounded-[4px] border border-border-soft bg-content/85 px-2 text-[10px] text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100"
        >
          <ArrowUpRight size={10} weight="bold" aria-hidden />
          Open
        </a>
      )}
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
      {/* Full-video upload — sets a separate video for the theater modal
          and the project detail page hero. Shows on all tiles (not just
          video heroes) so you can pair a static screenshot cover with
          a full walkthrough video. */}
      {
        <>
           <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!uploadingVideo) fullVideoInputRef.current?.click();
            }}
            aria-label={uploadingVideo ? "Uploading video…" : project.fullVideoUrl ? "Replace full video" : "Add full video"}
            title={uploadingVideo ? "Uploading video…" : project.fullVideoUrl ? "Replace full video" : "Add full video for Play"}
            className={
              "absolute bottom-3 inline-flex h-7 items-center justify-center rounded-[4px] border border-border-soft text-muted transition-[opacity,color] hover:text-fg group-hover:opacity-100 " +
              (project.heroImageUrl && isVideoUrl(project.heroImageUrl)
                ? "left-12 "
                : "left-3 ") +
              (uploadingVideo
                ? "w-auto gap-1.5 px-2 bg-fg/15 text-fg opacity-100"
                : "w-7 opacity-0 " + (project.fullVideoUrl ? "bg-fg/15 text-fg" : "bg-content/85"))
            }
          >
            {uploadingVideo ? (
              <>
                <CircleNotch size={11} weight="bold" className="animate-spin" aria-hidden />
                <span className="text-[10px]">Uploading…</span>
              </>
            ) : (
              <FilmStrip size={13} weight={project.fullVideoUrl ? "fill" : "regular"} aria-hidden />
            )}
          </button>
          <input
            ref={fullVideoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setUploadingVideo(true);
                onFullVideoChange(f).finally(() => setUploadingVideo(false));
              }
              e.target.value = "";
            }}
            className="hidden"
          />
        </>
      }
      {/* Folder chip — a true on/off toggle.
            • Not promoted (outline): single-click opens an inline name
              input; submitting promotes the tile.
            • Promoted (filled): single-click immediately demotes back
              to a media tile (isOpenable=false; title is preserved so
              re-promoting reuses the same name).
            • Double-click ALWAYS opens the rename input — that's how a
              promoted tile gets renamed without losing the toggle. */}
      {!renaming && (
        <button
          type="button"
          aria-label={
            promotedAlready
              ? "Demote to media tile (double-click to rename)"
              : "Promote to a project"
          }
          aria-pressed={promotedAlready}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (promotedAlready) {
              onDemote();
            } else {
              startRename();
            }
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Promoted tiles need a way to rename without un-promoting;
            // double-click is the gesture. Outline tiles just open the
            // rename input either way.
            startRename();
          }}
          title={
            promotedAlready
              ? "Click to remove project · double-click to rename"
              : "Click to make this a project"
          }
          className={
            "absolute bottom-3 inline-flex h-7 w-7 items-center justify-center rounded-[4px] border border-border-soft text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover:opacity-100 " +
            (project.heroImageUrl && isVideoUrl(project.heroImageUrl)
              ? "left-[5.25rem] "
              : "left-12 ") +
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
  fullVideoUrl,
  title,
  links = [],
  protected: isProtected,
  priority = false,
  openOverlay = false,
}: {
  url: string | null;
  posterUrl?: string | null;
  hasAudio?: boolean;
  fullVideoUrl?: string | null;
  title: string;
  links?: TileLink[];
  protected?: boolean;
  priority?: boolean;
  openOverlay?: boolean;
}) {
  const hasLinks = links.length > 0;
  const hasOverlay = openOverlay || hasLinks;
  const isVideo = !!url && isVideoUrl(url);

  return (
    <div className="group/tile relative flex-1 overflow-hidden rounded-[6px] border border-border bg-hover">
      {url ? (
        isVideo ? (
          <HeroVideo
            src={url}
            posterUrl={posterUrl ?? null}
            ariaLabel={title}
            hasAudio={hasAudio}
            fullVideoUrl={fullVideoUrl}
            links={links}
          />
        ) : (
          <SkeletonImage
            src={url}
            alt={title}
            fill
            sizes={HERO_SIZES}
            priority={priority}
            unoptimized
            className={
              "object-cover transition-[filter] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (hasOverlay ? "group-hover/tile:blur-[3px]" : "")
            }
          />
        )
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-hover via-content to-hover px-4 text-center text-muted">
          <ImageIcon size={20} weight="bold" aria-hidden />
          {title && (
            <p className="line-clamp-2 text-[13px] font-medium text-fg">
              {title}
            </p>
          )}
        </div>
      )}
      {/* Centered hover overlay — title + action buttons. Rendered for
          image tiles and videos without audio. Video tiles WITH audio
          get their links rendered inside HeroVideo's own overlay (next
          to the Play button) so both affordances sit in the same row. */}
      {hasOverlay && !(isVideo && hasAudio) && (
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
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 opacity-0 transition-opacity duration-300 ease-out group-hover/tile:opacity-100">
            {title?.trim() && (
              <span className="max-w-[90%] text-center text-[14px] font-medium leading-tight text-white drop-shadow-[0_2px_10px_rgb(0_0_0_/_0.55)]">
                <span className="line-clamp-2 break-all">{title}</span>
              </span>
            )}
            <div className="flex items-center justify-center gap-2">
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto inline-flex max-w-[140px] items-center gap-1.5 truncate whitespace-nowrap rounded-[6px] bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  {link.label}
                  <ArrowUpRight size={12} weight="bold" className="shrink-0" />
                </a>
              ))}
              {openOverlay && (
                <span className="inline-flex max-w-[140px] items-center gap-1.5 truncate whitespace-nowrap rounded-[6px] bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">
                  Open
                  <ArrowUpRight size={12} weight="bold" className="shrink-0" />
                </span>
              )}
            </div>
          </div>
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
