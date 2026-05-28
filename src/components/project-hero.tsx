"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  posterUrl?: string | null;
  ariaLabel: string;
  /** True when the video has meaningful audio worth playing for the
   *  visitor; flips the hero into unmuted-autoplay + native controls. */
  hasAudio: boolean;
};

/**
 * Large hero video on the project detail page.
 *
 *  • `hasAudio = true`: tries to autoplay with sound, falls back to muted
 *    autoplay if the browser's autoplay policy rejects an unmuted play()
 *    (most desktop browsers + iOS Safari without a recent user gesture).
 *    Native controls are exposed so the viewer can unmute if it fell back,
 *    or pause / scrub at any time.
 *  • `hasAudio = false`: plays muted on a loop — calm motion without any
 *    chrome (matches the gallery's silent-hero treatment).
 */
export function ProjectHero({ src, posterUrl, ariaLabel, hasAudio }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Tracks whether the element is currently muted so the controls UI is
  // honest about its state if the autoplay-with-audio attempt failed.
  const [muted, setMuted] = useState(!hasAudio);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Attempt unmuted playback for hasAudio videos. Browsers reject the
    // play() promise when their autoplay policy blocks it; we catch that,
    // mute, and retry so the viewer at least gets motion. Controls let
    // them unmute by hand.
    v.muted = !hasAudio;
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => undefined);
      });
    }
  }, [hasAudio, src]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={posterUrl ?? undefined}
      aria-label={ariaLabel}
      autoPlay
      loop={!hasAudio}
      playsInline
      controls={hasAudio}
      muted={muted}
      preload="auto"
      className="h-full w-full object-cover"
    />
  );
}
