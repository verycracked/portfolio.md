"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "@phosphor-icons/react/dist/ssr";

type Props = {
  src: string;
  ariaLabel: string;
};

/**
 * Auto-playing hero video on desktop / tap-to-play on touch devices.
 *
 * Touch devices are detected with `(hover: none) and (pointer: coarse)` —
 * the same media query browsers use to distinguish coarse-pointer phones &
 * tablets from precise-pointer laptops & desktops. On those devices the
 * video stays paused (saving bandwidth and keeping the page calm), with a
 * play affordance overlaid; on desktop it autoplays muted on load just
 * like before.
 */
export function HeroVideo({ src, ariaLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // `null` until we've measured matchMedia; lets us avoid an SSR/CSR drift
  // (server doesn't know if the client is touch). The overlay only renders
  // once we know, so visitors don't see a flicker.
  const [isTouch, setIsTouch] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);

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
    <div className="relative h-full w-full">
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
        // Only autoplay on non-touch devices. On touch, stay paused until tap.
        autoPlay={isTouch === false}
        preload="auto"
        controls={false}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedData={(e) => {
          if (isTouch === false) {
            const v = e.currentTarget;
            v.muted = true;
            const p = v.play();
            if (p && typeof p.catch === "function") p.catch(() => undefined);
          }
        }}
        onClick={isTouch ? togglePlay : undefined}
        className="h-full w-full object-cover"
      />
      {/* Play affordance for touch devices when paused. The video element
          underneath owns the tap target so a single tap fires onClick → play. */}
      {isTouch && !playing && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePlay();
          }}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-bg/30 transition-opacity"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border-soft bg-content/95 text-fg shadow-lg">
            <Play size={18} weight="fill" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
