"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Reorder } from "motion/react";
import { ArrowUpRight, Image as ImageIcon, Lock, Plus } from "@phosphor-icons/react/dist/ssr";
import { isVideoUrl } from "@/lib/media";

export type GalleryProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string | null;
  isProtected: boolean;
  /** 1–4 — number of grid columns this card occupies horizontally. */
  colSpan: number;
  /** 1–2 — number of grid rows this card occupies vertically. */
  rowSpan: number;
};

// Static class maps so Tailwind's JIT can see the literal class names.
// Dynamic interpolation (`col-span-${n}`) wouldn't be picked up. Grid caps
// at 2 columns × 2 rows — four distinct card sizes total.
const COL_SPAN_CLASS: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
};
const ROW_SPAN_CLASS: Record<number, string> = {
  1: "sm:row-span-1",
  2: "sm:row-span-2",
};

function spanClass(colSpan: number, rowSpan: number): string {
  const c = COL_SPAN_CLASS[Math.min(2, Math.max(1, colSpan))] ?? COL_SPAN_CLASS[1];
  const r = ROW_SPAN_CLASS[Math.min(2, Math.max(1, rowSpan))] ?? ROW_SPAN_CLASS[1];
  return `${c} ${r}`;
}

// How long to wait after a drag before pushing the new order to the API.
// Keeps rapid reorder gestures from spamming the network.
const REORDER_SAVE_DEBOUNCE_MS = 350;

/**
 * Project gallery grid. The page chrome (avatar + tabs + owner actions) is
 * owned by the (site) layout's SiteShell; this component only renders the
 * project cards + the "new project" affordance for owners.
 *
 * Owner view enables drag-to-reorder via motion's `Reorder`. Visitors see a
 * plain grid. Drag persists to `POST /api/projects/reorder` on a debounce.
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  // Re-sync when the server data changes (e.g., after a router.refresh()
  // post-create or post-delete in NewProjectCard / Card).
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

  const handleReorder = (next: GalleryProject[]) => {
    setProjects(next);
    persistOrder(next);
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
    // Visitor (and owner-previewing): static bento grid, no drag affordances.
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:auto-rows-[260px]">
        {projects.map((p, i) => (
          <div
            key={p.id}
            className={`animate-fade-rise ${spanClass(p.colSpan, p.rowSpan)}`}
            style={{ ["--reveal-delay" as string]: `${200 + i * 60}ms` }}
          >
            <Card project={p} owner={false} />
          </div>
        ))}
      </div>
    );
  }

  // Owner: drag-to-reorder bento grid. The "+ new project" tile stays in
  // the grid (after the last project) as a plain div — not a Reorder.Item —
  // so motion ignores it during drag and it always sits at the end.
  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={projects}
      onReorder={handleReorder}
      data-reordering={draggingId ? "1" : undefined}
      className="reorder-grid grid grid-cols-1 gap-6 sm:grid-cols-2 sm:auto-rows-[260px]"
      layoutScroll
    >
      {projects.map((p, i) => (
        <Reorder.Item
          key={p.id}
          value={p}
          as="div"
          data-dragging={draggingId === p.id ? "1" : undefined}
          className={`animate-fade-rise reorder-card touch-none cursor-grab active:cursor-grabbing ${spanClass(p.colSpan, p.rowSpan)}`}
          style={{ ["--reveal-delay" as string]: `${200 + i * 60}ms` }}
          onDragStart={() => setDraggingId(p.id)}
          onDragEnd={() => setDraggingId(null)}
          whileDrag={{
            scale: 1.04,
            rotate: -1.2,
            zIndex: 30,
            boxShadow: "0 24px 56px -16px rgb(0 0 0 / 0.55)",
          }}
          transition={{ type: "spring", stiffness: 520, damping: 38 }}
        >
          <Card project={p} owner />
        </Reorder.Item>
      ))}
      <div
        key="__new-project"
        className="animate-fade-rise reorder-card"
        style={{
          ["--reveal-delay" as string]: `${200 + projects.length * 60}ms`,
        }}
      >
        <NewProjectCard />
      </div>
    </Reorder.Group>
  );
}

/* Outer card shell — static (no pointer-light tilt or hover highlight).
 *   - 1px ring border via the double-stroke chrome
 *   - 4px inner padding around the hero
 */
function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="double-stroke flex h-full flex-col overflow-hidden rounded-[8px] bg-hover">
      <div className="relative z-[1] flex flex-1 flex-col gap-1 p-1">
        {children}
      </div>
    </div>
  );
}

/**
 * Image-only portfolio card. Click navigates to the project surface; the
 * hero (image or video) fills the entire card. Title + description live on
 * the project page itself, not on the card thumbnail.
 */
function Card({ project, owner }: { project: GalleryProject; owner: boolean }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group relative block h-full"
      aria-label={project.title}
    >
      <CardShell>
        <HeroFrame
          url={project.heroImageUrl}
          title={project.title}
          protected={project.isProtected}
        />
      </CardShell>
      {owner && (
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/90 px-2 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
          Open
          <ArrowUpRight weight="fill" size={10} aria-hidden />
        </span>
      )}
    </Link>
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

function NewProjectCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled project" }),
    });
    setBusy(false);
    if (!res.ok) return;
    const project = (await res.json()) as { id: string };
    router.push(`/edit/${project.id}`);
  };

  return (
    <button
      type="button"
      onClick={create}
      disabled={busy}
      className="group block h-full w-full text-left"
    >
      <CardShell>
        <div className="flex aspect-[16/10] items-center justify-center gap-1.5 rounded-[6px] border border-dashed border-border bg-hover text-[13px] text-muted transition-colors group-hover:border-fg group-hover:text-fg">
          {busy ? (
            "Creating…"
          ) : (
            <>
              <Plus weight="fill" size={14} aria-hidden />
              New project
            </>
          )}
        </div>
        <div className="flex flex-1 flex-col px-4 py-3">
          <h2 className="text-[14px] font-medium text-tertiary">Add a project</h2>
          <p className="mt-1 text-[13px] text-tertiary">
            Title, description, hero image, body.
          </p>
        </div>
      </CardShell>
    </button>
  );
}
