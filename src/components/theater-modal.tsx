"use client";

import { useEffect, useRef, useState } from "react";
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
 * Entrance: the backdrop and video dissolve in together (opacity +
 * subtle scale-up on the video, backdrop blur fades in). Exit reverses
 * the same animation before unmounting.
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
  const [phase, setPhase] = useState<"entering" | "open" | "exiting">("entering");

  // Kick the entering → open transition on mount.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
  }, []);

  const handleClose = () => {
    setPhase("exiting");
  };

  const onTransitionEnd = () => {
    if (phase === "exiting") onClose();
  };

  if (typeof window === "undefined") return null;

  const isVisible = phase === "open";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={handleClose}
      onTransitionEnd={onTransitionEnd}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      style={{
        backgroundColor: isVisible ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0)",
        backdropFilter: isVisible ? "blur(12px)" : "blur(0px)",
        WebkitBackdropFilter: isVisible ? "blur(12px)" : "blur(0px)",
        transition: "background-color 350ms ease-out, backdrop-filter 350ms ease-out, -webkit-backdrop-filter 350ms ease-out",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        aria-label="Close"
        className="absolute right-4 top-4 z-[101] inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-all"
        style={{
          opacity: isVisible ? 1 : 0,
          backgroundColor: isVisible ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0)",
          transition: "opacity 250ms ease-out 100ms, background-color 200ms ease-out",
        }}
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
        className="block max-h-[90vh] w-full max-w-[1400px] rounded-[8px]"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "scale(1)" : "scale(0.95)",
          filter: isVisible ? "blur(0px)" : "blur(8px)",
          boxShadow: isVisible
            ? "0 32px 96px -24px rgba(0,0,0,0.8)"
            : "0 0 0 0 rgba(0,0,0,0)",
          transition: "opacity 350ms ease-out, transform 350ms cubic-bezier(0.22, 1, 0.36, 1), filter 350ms ease-out, box-shadow 350ms ease-out",
        }}
      />
    </div>,
    document.body
  );
}
