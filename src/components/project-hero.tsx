"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react/dist/ssr";

type Props = {
  src: string;
  posterUrl?: string | null;
  ariaLabel: string;
};

/**
 * Large hero video on the project detail page.
 *
 * Always tries to autoplay with audio on. Browsers commonly reject the
 * unmuted play() promise without a recent user gesture; when that
 * happens we mute, replay, and surface a small "Tap to unmute" affordance
 * so the viewer can flip audio on with a single click. Once they do, the
 * video stays in their preferred state for the rest of the visit.
 */
export function ProjectHero({ src, posterUrl, ariaLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Tracks the *actual* muted state of the DOM element so the unmute chip
  // can stay in sync if the browser silently muted us.
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Browser blocked unmuted autoplay. Mute and retry so the visitor
        // at least sees motion; the chip surfaces the unmute action.
        v.muted = true;
        setMuted(true);
        v.play().catch(() => undefined);
      });
    }
  }, [src]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    // After a user gesture the autoplay policy is satisfied, so a play()
    // call here will succeed even if it was previously rejected.
    if (!next && v.paused) {
      v.play().catch(() => undefined);
    }
  };

  return (
    <div className="group relative h-full w-full">
      <video
        ref={videoRef}
        src={src}
        poster={posterUrl ?? undefined}
        aria-label={ariaLabel}
        autoPlay
        playsInline
        controls
        preload="auto"
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        className="h-full w-full object-cover"
      />
      {/* Unmute affordance — surfaces only when the browser muted us on
          autoplay. Sits above the native controls so it's tappable without
          opening the scrubber. */}
      {muted && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label="Unmute"
          className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition-colors hover:bg-black/80"
        >
          <SpeakerSlash size={14} weight="fill" aria-hidden />
          Tap to unmute
        </button>
      )}
      {!muted && (
        // When audio is on, fade out the unmute chip but keep a small
        // confirmation glance for the first second so the viewer knows
        // they're hearing the real thing.
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[12px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-80"
        >
          <SpeakerHigh size={14} weight="fill" aria-hidden />
          Audio on
        </span>
      )}
    </div>
  );
}
