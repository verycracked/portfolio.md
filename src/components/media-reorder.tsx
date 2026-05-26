"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { DotsSixVertical, X } from "@phosphor-icons/react/dist/ssr";
import { isVideoUrl } from "@/lib/media";

type Position = "before" | "after";

type MediaCtx = {
  urls: string[];
  draggingUrl: string | null;
  targetUrl: string | null;
  targetPos: Position | null;
  /** True when this provider is enabled (owner mode). */
  enabled: boolean;
  onDragStart: (url: string) => void;
  onDragOver: (url: string, pos: Position) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDelete: (url: string) => void;
};

const MediaReorderContext = createContext<MediaCtx | null>(null);

/**
 * Wrap the markdown render with this provider to make every standalone
 * `![](url)` block on the page drag-reorderable and deletable. The provider
 * holds the live ordered list; persist hits `POST /api/pages/[slug]/media`
 * which rewrites the body and we `router.refresh()` so the new order shows
 * immediately. Non-owners pass `enabled={false}` and the wrapped blocks
 * render as plain media.
 */
export function MediaReorderProvider({
  slug,
  initialUrls,
  enabled,
  children,
}: {
  slug: string;
  initialUrls: string[];
  enabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [draggingUrl, setDraggingUrl] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [targetPos, setTargetPos] = useState<Position | null>(null);

  // Re-sync if the server data changes underneath us (e.g. another tab
  // uploaded a file, or the dropzone just appended new URLs).
  useEffect(() => {
    setUrls(initialUrls);
  }, [initialUrls]);

  const clearDrag = useCallback(() => {
    setDraggingUrl(null);
    setTargetUrl(null);
    setTargetPos(null);
  }, []);

  const persist = useCallback(
    async (next: string[]) => {
      try {
        const res = await fetch(`/api/pages/${slug}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ urls: next }),
        });
        if (res.ok) router.refresh();
      } catch {
        // Network blip — local state stays, server is the source of truth
        // on next refresh.
      }
    },
    [slug, router]
  );

  const onDragStart = useCallback(
    (url: string) => {
      if (!enabled) return;
      setDraggingUrl(url);
    },
    [enabled]
  );

  const onDragOver = useCallback(
    (url: string, pos: Position) => {
      if (!enabled || !draggingUrl) return;
      if (url === draggingUrl) return;
      if (url === targetUrl && pos === targetPos) return;
      setTargetUrl(url);
      setTargetPos(pos);
    },
    [enabled, draggingUrl, targetUrl, targetPos]
  );

  const onDrop = useCallback(() => {
    if (!draggingUrl || !targetUrl || !targetPos) {
      clearDrag();
      return;
    }
    const from = urls.indexOf(draggingUrl);
    if (from === -1) {
      clearDrag();
      return;
    }
    const next = [...urls];
    next.splice(from, 1);
    // Recompute target index after removal so the insertion lands where the
    // visual indicator was.
    let to = next.indexOf(targetUrl);
    if (to === -1) {
      clearDrag();
      return;
    }
    if (targetPos === "after") to += 1;
    next.splice(to, 0, draggingUrl);
    setUrls(next);
    clearDrag();
    void persist(next);
  }, [draggingUrl, targetUrl, targetPos, urls, persist, clearDrag]);

  const onDelete = useCallback(
    async (url: string) => {
      const next = urls.filter((u) => u !== url);
      setUrls(next);
      await persist(next);
    },
    [urls, persist]
  );

  const ctx: MediaCtx = {
    urls,
    draggingUrl,
    targetUrl,
    targetPos,
    enabled,
    onDragStart,
    onDragOver,
    onDragEnd: clearDrag,
    onDrop,
    onDelete,
  };

  return (
    <MediaReorderContext.Provider value={ctx}>
      {children}
    </MediaReorderContext.Provider>
  );
}

type Props = {
  url: string;
  alt?: string;
};

/**
 * Block-level wrapper used by the markdown renderer for standalone `![]()`
 * images. When inside a `MediaReorderProvider` with `enabled={true}` and
 * the URL is in the reorderable list, the block becomes draggable and
 * exposes a hover delete button. Otherwise it renders as a plain image or
 * video so visitors see the unmodified design.
 */
export function MediaBlock({ url, alt }: Props) {
  const ctx = useContext(MediaReorderContext);
  const reorderable = ctx?.enabled && ctx.urls.includes(url);
  const isVideo = isVideoUrl(url);

  if (!reorderable || !ctx) {
    return isVideo ? (
      <video
        src={url}
        className="block w-full rounded-[6px]"
        muted
        loop
        playsInline
        autoPlay
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt ?? ""}
        className="block w-full rounded-[6px]"
      />
    );
  }

  const isDragging = ctx.draggingUrl === url;
  const isTarget = ctx.targetUrl === url && ctx.draggingUrl !== url;
  const dropPos = isTarget ? ctx.targetPos : null;

  const handleDragOver = (e: React.DragEvent<HTMLSpanElement>) => {
    if (!ctx.draggingUrl || ctx.draggingUrl === url) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const pos: Position = e.clientY < mid ? "before" : "after";
    ctx.onDragOver(url, pos);
  };

  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers need a payload to consider the gesture a drag.
        try {
          e.dataTransfer.setData("text/plain", url);
        } catch {
          // ignore — Safari sometimes throws on synthetic events
        }
        ctx.onDragStart(url);
      }}
      onDragOver={handleDragOver}
      onDrop={(e) => {
        e.preventDefault();
        ctx.onDrop();
      }}
      onDragEnd={() => ctx.onDragEnd()}
      className={
        "group/media relative my-1 inline-block w-full cursor-grab align-top transition-opacity active:cursor-grabbing " +
        (isDragging ? "opacity-30" : "")
      }
    >
      {dropPos === "before" && <DropIndicator side="top" />}
      {isVideo ? (
        <video
          src={url}
          className="pointer-events-none block w-full rounded-[6px]"
          muted
          loop
          playsInline
          autoPlay
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ""}
          className="pointer-events-none block w-full rounded-[6px]"
          draggable={false}
        />
      )}
      <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/85 px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover/media:opacity-100">
        <DotsSixVertical size={11} weight="bold" aria-hidden />
        Drag
      </span>
      <button
        type="button"
        onClick={() => ctx.onDelete(url)}
        aria-label="Remove media"
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-border-soft bg-content/85 text-muted opacity-0 transition-[opacity,color] hover:text-fg group-hover/media:opacity-100"
      >
        <X size={11} weight="bold" aria-hidden />
      </button>
      {dropPos === "after" && <DropIndicator side="bottom" />}
    </span>
  );
}

function DropIndicator({ side }: { side: "top" | "bottom" }) {
  // Glowing pill that the dragged card snaps to. Position outside the block
  // so it sits in the gap between media items, not over the artwork.
  return (
    <span
      aria-hidden
      className={
        "pointer-events-none absolute left-0 right-0 h-[3px] rounded-full bg-fg shadow-[0_0_0_3px_rgb(250_250_249_/_0.18)] " +
        (side === "top" ? "-top-[6px]" : "-bottom-[6px]")
      }
    />
  );
}
