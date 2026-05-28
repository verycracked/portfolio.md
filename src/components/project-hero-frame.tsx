"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowsOutCardinal } from "@phosphor-icons/react/dist/ssr";

type Props = {
  projectId: string;
  src: string;
  alt: string;
  initialOffsetY: number;
  owner: boolean;
};

const DEBOUNCE_MS = 350;

/**
 * Fixed-aspect cover frame for the project detail page. The image is
 * rendered with `object-fit: cover` so any extra height in the source PNG
 * is hidden — and the owner can drag the image vertically to pan into
 * the right framing. The vertical offset (0–100, where 50 = centered) is
 * stored on the project as `heroOffsetY`.
 *
 * Visitor mode: just renders the image at the persisted offset; no drag.
 */
export function ProjectHeroFrame({
  projectId,
  src,
  alt,
  initialOffsetY,
  owner,
}: Props) {
  const [offsetY, setOffsetY] = useState(initialOffsetY);
  // Track whether we're currently dragging — drives cursor + skips
  // accidental persists while values are moving.
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Pointer state for the drag gesture — captured once on pointerdown so
  // subsequent moves resolve against a stable anchor.
  const dragState = useRef<{
    startY: number;
    startOffsetY: number;
    frameHeight: number;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  const persist = (next: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heroOffsetY: next }),
      });
    }, DEBOUNCE_MS);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!owner) return;
    const frame = frameRef.current;
    if (!frame) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    dragState.current = {
      startY: e.clientY,
      startOffsetY: offsetY,
      // Use the frame's height as the pan budget — 0..100 spans roughly
      // one frame height worth of drag, which feels right for the size
      // of the typical cover.
      frameHeight: frame.getBoundingClientRect().height,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragState.current;
    if (!s) return;
    const dy = e.clientY - s.startY;
    // Dragging DOWN means the user wants to see content from ABOVE the
    // current view, i.e. shift the visible window upward in the image,
    // which is object-position-Y → 0.
    const deltaPct = (dy / s.frameHeight) * 100;
    const next = Math.max(0, Math.min(100, s.startOffsetY - deltaPct));
    setOffsetY(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    dragState.current = null;
    setDragging(false);
    persist(offsetY);
  };

  // Allow fine-tuning with arrow keys when the frame has keyboard focus.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!owner) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 2;
    const next = Math.max(
      0,
      Math.min(100, offsetY + (e.key === "ArrowDown" ? -step : step))
    );
    setOffsetY(next);
    persist(next);
  };

  return (
    <div
      ref={frameRef}
      tabIndex={owner ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={
        "group relative aspect-[16/10] w-full overflow-hidden " +
        (owner
          ? dragging
            ? "cursor-grabbing"
            : "cursor-grab"
          : "")
      }
      role={owner ? "slider" : undefined}
      aria-label={owner ? "Drag to reframe cover" : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(offsetY)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="h-full w-full select-none object-cover"
        style={{ objectPosition: `50% ${offsetY}%` }}
      />
      {owner && (
        <>
          {/* Drag-hint chip — appears on hover, hides while dragging
              (the cursor itself takes over the affordance then). */}
          <span
            aria-hidden
            className={
              "pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/85 px-1.5 py-0.5 text-[10px] text-muted backdrop-blur transition-opacity " +
              (dragging
                ? "opacity-0"
                : "opacity-0 group-hover:opacity-100")
            }
          >
            <ArrowsOutCardinal size={11} weight="bold" />
            Drag to reframe
          </span>
        </>
      )}
    </div>
  );
}
