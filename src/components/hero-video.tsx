"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  ariaLabel: string;
};

/**
 * Hero video: autoplays muted on desktop; on touch devices it stays paused
 * showing just the first frame (no overlay, no play button — reads like a
 * static image). Tapping the tile starts/pauses playback silently.
 *
 * Touch devices are detected with `(hover: none) and (pointer: coarse)`,
 * the same media query browsers use to distinguish coarse-pointer phones
 * & tablets from precise-pointer laptops & desktops.
 */
export function HeroVideo({ src, ariaLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // `null` until we've measured matchMedia; the autoPlay attribute reads
  // this so we don't drift between SSR and CSR.
  const [isTouch, setIsTouch] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    setIsTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  return (
    <video
      ref={(el) => {
        videoRef.current = el;
        if (el) el.muted = true;
      }}
      src={src}
      aria-label={ariaLabel}
      muted
      loop
      playsInline
      // Autoplay only on non-touch devices. Touch shows a static first
      // frame until the user taps.
      autoPlay={isTouch === false}
      preload="auto"
      controls={false}
      onLoadedData={(e) => {
        if (isTouch !== false) return;
        const v = e.currentTarget;
        v.muted = true;
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => undefined);
      }}
      // Tap to toggle on touch devices; desktop ignores this (autoplay
      // already running, and we don't want a stray click on a non-clickable
      // tile to pause playback).
      onClick={isTouch ? togglePlay : undefined}
      className="h-full w-full object-cover"
    />
  );
}
