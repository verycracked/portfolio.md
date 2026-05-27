"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/dist/ssr";

type Props = {
  src: string;
  posterUrl?: string | null;
  ariaLabel: string;
  onClose: () => void;
};

/**
 * Fullscreen "theater" modal for watching a video with audio.
 *
 *  • Esc, the backdrop, or the close button all dismiss.
 *  • Body scroll is locked while open.
 *  • Renders into a portal so the modal escapes any clipped/transformed
 *    parent (the gallery sits inside a fixed-position card with
 *    overflow-hidden, which would otherwise crop the modal).
 *  • Video starts unmuted with native browser controls so the viewer can
 *    seek, adjust volume, or fullscreen via the platform UI.
 */
export function TheaterModal({ src, posterUrl, ariaLabel, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Auto-play with audio on open. Some browsers block unmuted autoplay
  // without a recent user gesture — opening the modal IS a gesture, so
  // play() inside this useEffect should be allowed. Fall back silently
  // and show controls so the viewer can hit play themselves.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Browser refused — leave video paused; controls are visible.
      });
    }
  }, []);

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute right-4 top-4 z-[101] inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={16} weight="bold" aria-hidden />
      </button>
      <video
        ref={videoRef}
        src={src}
        poster={posterUrl ?? undefined}
        controls
        playsInline
        autoPlay
        onClick={(e) => e.stopPropagation()}
        className="block max-h-[90vh] w-auto max-w-[1400px] rounded-[8px] shadow-[0_32px_96px_-24px_rgb(0_0_0_/_0.8)]"
      />
    </div>,
    document.body
  );
}
