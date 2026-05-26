"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  ariaLabel: string;
};

/**
 * Hero video: autoplays muted on desktop; on touch devices it shows just
 * the first frame (no overlay, no play button — reads like a static image)
 * and tapping toggles playback silently.
 *
 * iOS Safari quirk: a paused <video> renders nothing until it's been
 * played at least once, even with preload="auto". To paint the first frame
 * without leaving the video running, we briefly `play()` then immediately
 * `pause()` after onLoadedData. The result is a still that looks like a
 * regular image.
 *
 * Touch detection uses `(hover: none) and (pointer: coarse)` — the same
 * media query browsers use to distinguish coarse-pointer phones / tablets
 * from precise-pointer laptops / desktops.
 */
export function HeroVideo({ src, ariaLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // null until we've measured matchMedia — avoids SSR/CSR drift on the
  // `autoPlay` attribute.
  const [isTouch, setIsTouch] = useState<boolean | null>(null);
  // After the user explicitly taps to play, we leave playback running so a
  // future onLoadedData (e.g. after a re-render) doesn't immediately pause.
  const userPlayingRef = useRef(false);

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
      userPlayingRef.current = true;
      v.muted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    } else {
      userPlayingRef.current = false;
      v.pause();
    }
  };

  // iOS-friendly first-frame paint: muted play, then pause once we have at
  // least one decoded frame. Skipped on desktop (autoplay handles it) and
  // when the user has explicitly tapped to keep playing.
  const paintFirstFrame = (v: HTMLVideoElement) => {
    v.muted = true;
    const p = v.play();
    if (!p || typeof p.then !== "function") return;
    p.then(() => {
      if (!userPlayingRef.current) v.pause();
    }).catch(() => undefined);
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
      // Autoplay only on non-touch devices. Touch devices get a "paint the
      // first frame then pause" dance in onLoadedData below.
      autoPlay={isTouch === false}
      preload="auto"
      controls={false}
      onLoadedData={(e) => {
        const v = e.currentTarget;
        v.muted = true;
        if (isTouch === false) {
          // Desktop: belt-and-braces explicit play (autoplay attribute
          // sometimes loses the race with React's muted-prop reconciliation).
          const p = v.play();
          if (p && typeof p.catch === "function") p.catch(() => undefined);
        } else if (isTouch === true) {
          paintFirstFrame(v);
        }
      }}
      // Tap toggles on touch. Desktop ignores click so a stray tap doesn't
      // pause the always-running ambient hero.
      onClick={isTouch ? togglePlay : undefined}
      className="h-full w-full object-cover"
    />
  );
}
