"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "motion/react";
import { ArrowUpRight, Lock } from "@phosphor-icons/react/dist/ssr";
import { isVideoUrl } from "@/lib/media";
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

// Offset between the cursor tip and the tooltip's bottom-left corner. Kept
// tight so the tooltip feels anchored to the cursor.
const OFFSET_X = 6;
const OFFSET_Y = 8;

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
  const [mounted, setMounted] = useState(false);
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

  const caseStudyHref = `/projects/${project.slug}/${project.firstSurfaceSlug}`;

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
        className={className}
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
        <ArrowUpRight
          weight="bold"
          size={11}
          aria-hidden
          className="nomo-pill-arrow text-tertiary"
        />
      </a>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                id={`case-study-${project.slug}`}
                role="tooltip"
                className="double-stroke pointer-events-auto fixed z-[100] w-[280px] origin-bottom-left rounded-[8px] bg-content p-3"
            // `left`/`top` come from the springs (cursor coords); the
            // transform shifts the tooltip's bottom-left anchor so the box
            // sits above + right of the cursor. The translate is part of
            // motion's transform stack and won't fight the position values.
            style={{
              left: x,
              top: y,
              translateX: OFFSET_X,
              translateY: `calc(-100% - ${OFFSET_Y}px)`,
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            // Keep the tooltip stable once the cursor enters it so the user
            // can actually reach the CTAs without it sliding away.
            onMouseEnter={clearTimers}
            onMouseLeave={requestClose}
          >
            {project.heroImageUrl && (
              <div className="relative z-[1] mb-3 aspect-[16/10] overflow-hidden rounded-[6px] border border-border-soft bg-hover">
                {isVideoUrl(project.heroImageUrl) ? (
                  <video
                    src={project.heroImageUrl}
                    className="h-full w-full object-cover"
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
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            )}

            <div className="relative z-[1] mb-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <h4 className="text-[13px] font-medium text-fg">
                  {project.title}
                </h4>
                {project.isProtected && (
                  <Lock
                    weight="fill"
                    size={11}
                    aria-label="Password protected"
                    className="text-tertiary"
                  />
                )}
              </div>
              {project.description && (
                <p className="text-[12px] leading-snug text-muted">
                  {project.description}
                </p>
              )}
            </div>

            <div className="relative z-[1] flex items-center gap-1.5">
              <Link
                href={caseStudyHref}
                className="inline-flex items-center gap-1 rounded-[5px] bg-fg px-2.5 py-1.5 text-[11.5px] font-medium text-content transition-opacity hover:opacity-90"
              >
                <span>View case study</span>
                <ArrowUpRight weight="bold" size={10} aria-hidden />
              </Link>
              <a
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1 rounded-[5px] bg-hover px-2.5 py-1.5 text-[11.5px] text-muted transition-colors hover:bg-border hover:text-fg"
              >
                <span>Open link</span>
                <ArrowUpRight weight="bold" size={10} aria-hidden />
              </a>
            </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </span>
  );
}
