"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { SpeakerHigh } from "@phosphor-icons/react/dist/ssr";
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

  // Centered "Have a listen" CTA + a soft diffusion bloom that fades in on
  // hover. The bloom is a radial darken layer with its own backdrop-blur —
  // together with the video's own hover blur they stack into a graduated
  // "out of focus" feel rather than a single flat blur step.
  const visibilityClass = isTouch
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100";

  const listenButton = (
    <>
      {/* Diffusion layer — a soft radial scrim that strengthens the
          backdrop-blur near the chip and tapers off toward the edges, so
          the focus visibly settles on the CTA. */}
      <div
        aria-hidden
        className={
          "pointer-events-none absolute inset-0 z-[5] transition-opacity duration-300 ease-out " +
          visibilityClass
        }
        style={{
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0) 75%)",
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0) 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0) 90%)",
        }}
      />
      <button
        type="button"
        aria-label={`Open ${ariaLabel} with audio`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openTheater();
        }}
        className={
          "absolute left-1/2 top-1/2 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 scale-95 items-center gap-2.5 rounded-full border border-white/15 bg-black/35 px-5 py-3 text-[14px] font-medium text-white shadow-[0_18px_44px_-16px_rgb(0_0_0_/_0.7)] backdrop-blur-xl transition-[opacity,transform,backdrop-filter] duration-300 ease-out group-hover:scale-100 " +
          visibilityClass
        }
      >
        <SpeakerHigh size={18} weight="fill" aria-hidden />
        Have a listen
      </button>
    </>
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
              // Touch shows the listen chip permanently, so blur the poster
              // permanently too — matches the diffusion treatment on desktop.
              className="scale-[1.02] object-cover blur-[3px]"
              draggable={false}
            />
          </button>
          {listenButton}
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
          className="h-full w-full object-cover transition-[filter,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] group-hover:blur-[3px]"
        />
        {listenButton}
      </div>
      {theater}
    </>
  );
}
