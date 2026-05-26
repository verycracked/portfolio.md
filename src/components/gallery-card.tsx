"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  DotsSixVertical,
  Image as ImageIcon,
  Lock,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { isVideoUrl } from "@/lib/media";
import type { GalleryProject } from "@/components/gallery-types";

type CommonProps = {
  project: GalleryProject;
  spanClass: string;
};

/**
 * Visitor card — plain `<Link>` wrapping the image/video. No drag, no
 * delete. Used both directly on /(site) for visitors and inside the
 * dnd-kit DragOverlay for the lifted "ghost" while dragging.
 */
export function GalleryCard({ project, spanClass }: CommonProps) {
  return (
    <div className={`relative ${spanClass}`}>
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

type OwnerProps = CommonProps & { onDelete: () => void };

/**
 * Owner card — wraps the visual card in a dnd-kit `useSortable` and adds
 * hover affordances (drag chip, delete button). Must be rendered inside a
 * `<SortableContext>`.
 */
export function SortableGalleryCard({ project, spanClass, onDelete }: OwnerProps) {
  const sortable = useSortable({ id: project.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 40 : undefined,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      data-dragging={sortable.isDragging ? "1" : undefined}
      className={`reorder-card relative ${spanClass}`}
    >
      <Link
        href={`/projects/${project.slug}`}
        aria-label={project.title}
        className="group block h-full cursor-grab select-none active:cursor-grabbing"
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
        <div className="flex h-full items-center justify-center text-tertiary">
          <ImageIcon size={28} weight="fill" aria-label="No image" />
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
