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
 *    Stops 8 tiles from auto-animating simultaneously — only the one the
 *    user is looking at moves.
 *  • Touch devices (phones, tablets): renders a plain <img src={poster}>
 *    by default — no decoded video, no chrome. Tapping swaps to a <video>
 *    and starts playback; tap again to pause.
 *
 * If `posterUrl` is null (legacy uploads pre-poster extraction), we fall
 * back to a video that autoplays — better than a blank tile.
 */
export function HeroVideo({ src, posterUrl, ariaLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // null until matchMedia runs — avoids SSR/CSR drift on the autoplay attr.
  const [isTouch, setIsTouch] = useState<boolean | null>(null);
  // Touch + has-poster path: stays on the poster <img> until tapped.
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

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.muted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    } else {
      v.pause();
    }
  };

  // Desktop = hover-to-play (no autoplay). Touch with no poster (legacy) =
  // autoplay so the tile isn't blank. Touch with poster + activated =
  // autoplay (the user just tapped).
  const desktopHoverMode = isTouch === false;
  const shouldAutoplay: boolean =
    (isTouch === true && !posterUrl) || (isTouch === true && activated);

  // Hover handlers for desktop. play() is called inside the event handler
  // so it inherits user-gesture context, which keeps Safari's autoplay
  // policy happy even though muted videos don't strictly require it.
  const onEnter = () => {
    if (!desktopHoverMode) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => undefined);
  };
  const onLeave = () => {
    if (!desktopHoverMode) return;
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    // Rewind so the next hover starts fresh on the poster frame.
    try {
      v.currentTime = 0;
    } catch {
      // ignore — Safari sometimes throws when the metadata isn't ready.
    }
  };

  return (
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
      // Pre-fetch metadata on desktop so play() on hover responds instantly;
      // touch path doesn't need this (we render an <img> instead).
      preload={shouldAutoplay || desktopHoverMode ? "auto" : "metadata"}
      controls={false}
      onLoadedData={(e) => {
        if (!shouldAutoplay) return;
        const v = e.currentTarget;
        v.muted = true;
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => undefined);
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={isTouch ? togglePlay : undefined}
      className="h-full w-full object-cover"
    />
  );
}
