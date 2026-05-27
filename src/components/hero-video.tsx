"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CornersOut } from "@phosphor-icons/react/dist/ssr";
import { TheaterModal } from "@/components/theater-modal";

const HERO_SIZES = "(min-width: 640px) 50vw, 100vw";

type Props = {
  src: string;
  posterUrl?: string | null;
  ariaLabel: string;
};

/**
 * Hero video with calm-by-default playback + theater mode for audio:
 *
 *  • Desktop (hover-capable pointer): shows the poster still on mount;
 *    hover plays muted silently, leave pauses. A discreet "expand" chip
 *    in the top-right corner opens the theater modal (full-window video
 *    with audio + native controls). Clicking the body of the tile also
 *    opens the modal.
 *  • Touch devices (phones, tablets): renders a poster <Image> by default
 *    (no decoded video). Tapping the expand chip opens the theater modal
 *    directly. The tile body tap reveals the inline <video> with silent
 *    autoplay so quick browsers still see motion.
 *
 * The expand chip is the universal "play with audio" affordance — present
 * on every video regardless of whether we know it has an audio track.
 */
export function HeroVideo({ src, posterUrl, ariaLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // null until matchMedia runs — avoids SSR/CSR drift on the autoplay attr.
  const [isTouch, setIsTouch] = useState<boolean | null>(null);
  // Touch + has-poster: stays on the poster <Image> until tapped.
  const [activated, setActivated] = useState(false);
  // When true, the theater modal is open.
  const [theaterOpen, setTheaterOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    setIsTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const desktopHoverMode = isTouch === false;
  const shouldAutoplay: boolean =
    (isTouch === true && !posterUrl) || (isTouch === true && activated);

  const playInline = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  };

  const pauseInline = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = 0;
    } catch {
      // Safari throws if metadata isn't ready — safe to ignore.
    }
  };

  const openTheater = () => setTheaterOpen(true);

  // Theater modal is the same regardless of inline mode.
  const theater = theaterOpen ? (
    <TheaterModal
      src={src}
      posterUrl={posterUrl}
      ariaLabel={ariaLabel}
      onClose={() => setTheaterOpen(false)}
    />
  ) : null;

  // The expand chip is shared by both code paths. Pointer-down stop
  // prevents dnd-kit from claiming the click as a drag in owner mode.
  const expandButton = (
    <button
      type="button"
      aria-label={`Open ${ariaLabel} with audio`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openTheater();
      }}
      className="absolute bottom-3 left-3 z-10 inline-flex h-7 items-center gap-1 rounded-[4px] border border-border-soft bg-content/85 px-2 text-[10px] text-muted opacity-0 backdrop-blur transition-[opacity,color] hover:text-fg group-hover:opacity-100"
    >
      <CornersOut size={11} weight="bold" aria-hidden />
      Audio
    </button>
  );

  // Touch + we have a poster: render the still by default. Tap the poster
  // to mount the inline <video>; tap the expand chip to go straight to
  // theater (which is where you'd actually hear audio).
  if (isTouch && posterUrl && !activated) {
    return (
      <>
        <div className="group relative h-full w-full">
          <button
            type="button"
            aria-label={`Play ${ariaLabel}`}
            onClick={() => setActivated(true)}
            className="relative block h-full w-full"
          >
            <Image
              src={posterUrl}
              alt={ariaLabel}
              fill
              sizes={HERO_SIZES}
              className="object-cover"
              draggable={false}
            />
          </button>
          {expandButton}
        </div>
        {theater}
      </>
    );
  }

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) playInline();
    else v.pause();
  };

  return (
    <>
      <div
        className="group relative h-full w-full"
        onPointerEnter={(e) => {
          if (!desktopHoverMode) return;
          if (e.pointerType === "touch") return;
          playInline();
        }}
        onPointerLeave={(e) => {
          if (!desktopHoverMode) return;
          if (e.pointerType === "touch") return;
          pauseInline();
        }}
        onMouseEnter={() => {
          if (!desktopHoverMode) return;
          playInline();
        }}
        onMouseLeave={() => {
          if (!desktopHoverMode) return;
          pauseInline();
        }}
      >
        <video
          ref={(el) => {
            videoRef.current = el;
            if (el) el.muted = true;
          }}
          src={src}
          poster={posterUrl ?? undefined}
          aria-label={ariaLabel}
          muted
          loop
          playsInline
          autoPlay={shouldAutoplay}
          preload={shouldAutoplay || desktopHoverMode ? "auto" : "metadata"}
          controls={false}
          onLoadedData={(e) => {
            if (!shouldAutoplay) return;
            const v = e.currentTarget;
            v.muted = true;
            const p = v.play();
            if (p && typeof p.catch === "function") p.catch(() => undefined);
          }}
          // Desktop: click anywhere on the tile opens the theater so the
          // viewer can hear audio. Touch: tap toggles inline playback —
          // they have the explicit "Audio" chip to enter theater.
          onClick={(e) => {
            if (isTouch) {
              togglePlay();
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            openTheater();
          }}
          className="h-full w-full object-cover"
        />
        {expandButton}
      </div>
      {theater}
    </>
  );
}
