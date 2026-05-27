"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const HERO_SIZES = "(min-width: 640px) 50vw, 100vw";

type Props = {
  src: string;
  posterUrl?: string | null;
  ariaLabel: string;
};

/**
 * Hero video with calm-by-default playback:
 *
 *  • Desktop (hover-capable pointer): shows the poster still on mount;
 *    starts playback when the pointer enters the tile and pauses on leave.
 *  • Touch devices (phones, tablets): renders a plain <Image src={poster}>
 *    by default — no decoded video, no chrome. Tapping swaps to a <video>
 *    and starts playback; tap again to pause.
 *
 * Hover handlers live on an outer wrapper that covers the entire tile area
 * (rather than the <video> element itself) so the chrome buttons sitting
 * on top of the video — drag chip, ×, resize handle — don't block the
 * mouseenter that triggers playback.
 *
 * If `posterUrl` is null (legacy uploads pre-poster extraction), we fall
 * back to a video that autoplays — better than a blank tile.
 */
export function HeroVideo({ src, posterUrl, ariaLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // null until matchMedia runs — avoids SSR/CSR drift on the autoplay attr.
  const [isTouch, setIsTouch] = useState<boolean | null>(null);
  // Touch + has-poster path: stays on the poster <Image> until tapped.
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    setIsTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Touch + we have a poster: render the still by default, mount the
  // <video> only after the user taps.
  if (isTouch && posterUrl && !activated) {
    return (
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
    );
  }

  // Desktop = hover-to-play. Touch with no poster (legacy) = autoplay.
  // Touch with poster + activated = autoplay (the user just tapped).
  const desktopHoverMode = isTouch === false;
  const shouldAutoplay: boolean =
    (isTouch === true && !posterUrl) || (isTouch === true && activated);

  const playNow = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  };

  const pauseNow = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = 0;
    } catch {
      // Safari occasionally throws when metadata isn't ready yet.
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) playNow();
    else v.pause();
  };

  return (
    // Wrap so the hover region covers the entire tile, including any
    // chrome buttons layered on top of the video. Pointer events are used
    // (instead of mouseenter) because they're consistent across mouse,
    // pen, and trackpad inputs and bubble through children predictably.
    <div
      className="relative h-full w-full"
      onPointerEnter={(e) => {
        if (!desktopHoverMode) return;
        // Skip touch-emulated pointer events on hybrid devices that may
        // briefly fire pointerenter with pointerType "touch".
        if (e.pointerType === "touch") return;
        playNow();
      }}
      onPointerLeave={(e) => {
        if (!desktopHoverMode) return;
        if (e.pointerType === "touch") return;
        pauseNow();
      }}
      // Fallback for older browsers that don't fire pointer events
      // consistently for `hover` state on the parent.
      onMouseEnter={() => {
        if (!desktopHoverMode) return;
        playNow();
      }}
      onMouseLeave={() => {
        if (!desktopHoverMode) return;
        pauseNow();
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
        onClick={isTouch ? togglePlay : undefined}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
