"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  posterUrl?: string | null;
  ariaLabel: string;
};

/**
 * Hero video with mobile-friendly behavior:
 *
 *  • Desktop (hover-capable pointer): a muted-autoplay-loop <video>. The
 *    `poster` attribute paints the first frame while the data is still
 *    fetching, so the tile never reads as blank.
 *  • Touch devices (phones, tablets): renders a plain <img src={poster}>
 *    by default — no autoplay, no decoded video, no chrome. Reads exactly
 *    like a static image. Tapping swaps to a <video> and starts playback
 *    silently. Tapping again pauses.
 *
 * If `posterUrl` is null (legacy uploads pre-poster extraction), we fall
 * back to rendering the <video> directly on every device. Autoplay still
 * works on modern mobile browsers for muted + playsInline videos.
 */
export function HeroVideo({ src, posterUrl, ariaLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // null until matchMedia runs — avoids SSR/CSR drift on the autoplay attr.
  const [isTouch, setIsTouch] = useState<boolean | null>(null);
  // On touch devices: stay on the poster <img> until the user explicitly
  // taps, then mount the <video> and play.
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
        className="block h-full w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterUrl}
          alt={ariaLabel}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </button>
    );
  }

  // Once activated on touch, OR on desktop, OR when there's no poster to
  // fall back to: render the actual <video>.
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

  // Autoplay rule: desktop yes; touch with no poster (legacy) yes; touch
  // with poster + activated yes (the user just tapped). `isTouch` is null
  // before matchMedia runs — treat that window as "not yet touch" so the
  // SSR render matches.
  const shouldAutoplay: boolean =
    isTouch === false ||
    (isTouch === true && !posterUrl) ||
    (isTouch === true && activated);

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
      preload={shouldAutoplay ? "auto" : "metadata"}
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
  );
}
