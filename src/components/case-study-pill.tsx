"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "motion/react";
import { ArrowUpRight, Lock } from "@phosphor-icons/react/dist/ssr";
import { isVideoUrl } from "@/lib/media";
import { PillArrow } from "@/components/pill-arrow";
import type { ProjectSummary } from "@/lib/case-study";

type Props = {
  /** Original external URL the pill was authored with. */
  href: string;
  external: boolean;
  label: React.ReactNode;
  /** Visual classes — supplied by the caller so inline + standalone pills
   *  can share this component while keeping their distinct layouts. */
  className: string;
  /** The matched portfolio project. Drives the hover tooltip. */
  project: ProjectSummary;
};

const OPEN_DELAY_MS = 180;
const CLOSE_DELAY_MS = 140;

// Spring config for the cursor-following tooltip. Quick enough that movement
// feels reactive, damped enough that it doesn't jitter when the mouse stops.
const FOLLOW_SPRING = { stiffness: 600, damping: 40, mass: 0.5 } as const;

// Layout offsets (px) relative to the raw cursor coords:
//   • cursor glyph sits at (0, 0)
//   • preview image floats just to the right of the glyph
//   • text tooltip stacks below the preview image
const CURSOR_GLYPH_SIZE = 16;
const PREVIEW_OFFSET_X = 22;
const PREVIEW_OFFSET_Y = -6;
const PREVIEW_WIDTH = 132;
const PREVIEW_HEIGHT = 82; // 132 × 82 ≈ 16:10
const TOOLTIP_OFFSET_X = 22;
// Tooltip sits below the preview image with a small gap.
const TOOLTIP_OFFSET_Y = PREVIEW_OFFSET_Y + PREVIEW_HEIGHT + 6;

/**
 * Pill that matched a portfolio project by slug. At rest it's visually
 * identical to a plain `(([…]))` pill; on hover (or focus) a Paper-selection
 * tooltip eases in with a hero preview, title + lock, description, and two
 * CTAs (view case study + open external link).
 *
 * The tooltip uses `position: fixed` driven by spring-smoothed cursor
 * coordinates so it follows the mouse while the cursor is over the pill.
 * Once the cursor leaves the pill (e.g., heading toward the tooltip to click
 * a CTA), the tooltip stops following so the user can actually reach it.
 */
export function CaseStudyPill({
  href,
  external,
  label,
  className,
  project,
}: Props) {
  const [open, setOpen] = useState(false);
  // `mounted` gates the createPortal call so we don't try to access
  // `document` during SSR or the very first client render (before commit).
  // The setState-in-effect is the idiomatic mount-detection pattern; no
  // external system to subscribe to, just a one-shot "we're past hydration".
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cursor-driven position. We write to the MotionValues; the spring smooths
  // the actual tooltip position so it doesn't jitter on rapid moves.
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const x = useSpring(cursorX, FOLLOW_SPRING);
  const y = useSpring(cursorY, FOLLOW_SPRING);

  const clearTimers = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const requestOpen = () => {
    clearTimers();
    openTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };

  const requestClose = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const updateCursor = (clientX: number, clientY: number) => {
    cursorX.set(clientX);
    cursorY.set(clientY);
  };

  useEffect(() => clearTimers, []);

  return (
    <span
      className="relative"
      onMouseLeave={requestClose}
      onBlur={requestClose}
    >
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        data-case-study={project.slug}
        aria-describedby={open ? `case-study-${project.slug}` : undefined}
        // Adds the custom ↗ cursor on top of the inherited pill chrome.
        className={`${className} nomo-case-study-pill`}
        onMouseEnter={(e) => {
          // Seed the spring at the first cursor position so the tooltip
          // doesn't fly in from a stale (0,0) when first opened.
          x.jump(e.clientX);
          y.jump(e.clientY);
          updateCursor(e.clientX, e.clientY);
          requestOpen();
        }}
        onMouseMove={(e) => updateCursor(e.clientX, e.clientY)}
        onFocus={(e) => {
          // Keyboard users: anchor the tooltip to the pill's top-left.
          const rect = e.currentTarget.getBoundingClientRect();
          x.jump(rect.left);
          y.jump(rect.top);
          requestOpen();
        }}
      >
        <span>{label}</span>
        <PillArrow />
      </a>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.span
                aria-hidden
                className="pointer-events-none fixed z-[102] text-fg"
                style={{ left: x, top: y }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                key="cursor-glyph"
              >
                <ArrowUpRight
                  weight="bold"
                  size={CURSOR_GLYPH_SIZE}
                  aria-hidden
                />
              </motion.span>
            )}

            {open && project.heroImageUrl && (
              <motion.div
                aria-hidden
                className="double-stroke pointer-events-none fixed z-[101] origin-top-left overflow-hidden rounded-[6px] bg-content"
                style={{
                  left: x,
                  top: y,
                  width: PREVIEW_WIDTH,
                  height: PREVIEW_HEIGHT,
                  translateX: PREVIEW_OFFSET_X,
                  translateY: PREVIEW_OFFSET_Y,
                }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                key="case-study-preview"
              >
                {isVideoUrl(project.heroImageUrl) ? (
                  <video
                    src={project.heroImageUrl}
                    className="relative z-[1] h-full w-full object-cover"
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.heroImageUrl}
                    alt=""
                    className="relative z-[1] h-full w-full object-cover"
                  />
                )}
              </motion.div>
            )}

            {open && (
              <motion.div
                id={`case-study-${project.slug}`}
                role="tooltip"
                className="double-stroke pointer-events-none fixed z-[100] w-[180px] origin-top-left rounded-[6px] bg-content p-2"
                style={{
                  left: x,
                  top: y,
                  translateX: TOOLTIP_OFFSET_X,
                  translateY: TOOLTIP_OFFSET_Y,
                }}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                key="case-study-tooltip"
              >
                <div className="relative z-[1] flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <h4 className="text-[11.5px] font-medium leading-tight text-fg">
                      {project.title}
                    </h4>
                    {project.isProtected && (
                      <Lock
                        weight="fill"
                        size={9}
                        aria-label="Password protected"
                        className="text-tertiary"
                      />
                    )}
                  </div>
                  {project.description && (
                    <p className="line-clamp-2 text-[10.5px] leading-snug text-muted">
                      {project.description}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </span>
  );
}
