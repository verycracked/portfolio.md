"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleNotch } from "@phosphor-icons/react/dist/ssr";

export type SaveState = "idle" | "saving" | "saved";

type Props = {
  state: SaveState;
};

/**
 * Inline indicator for the auto-saving editor. Stays out of the way at
 * rest ("Saved") and animates a small spinner during in-flight writes.
 * Use with `useSaveTracker` below: wrap any async save call in
 * `tracker.track(...)` and bind the resulting `state` to this component.
 */
export function SaveStatusBadge({ state }: Props) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-[12px] text-tertiary"
    >
      {state === "saving" ? (
        <>
          <CircleNotch size={11} weight="bold" className="animate-spin" aria-hidden />
          <span>Saving…</span>
        </>
      ) : state === "saved" ? (
        <>
          <Check size={11} weight="bold" aria-hidden />
          <span>Saved</span>
        </>
      ) : (
        <span className="opacity-0">Saved</span>
      )}
    </span>
  );
}

/**
 * Tracks how many writes are currently in flight so the editor can show
 * "Saving…" while any are pending and "Saved" briefly after the last
 * one resolves. `track(promise)` increments the in-flight counter,
 * decrements when the promise settles, and never throws — callers stay
 * responsible for handling the underlying error.
 */
export function useSaveTracker() {
  const inFlightRef = useRef(0);
  const savedClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<SaveState>("idle");

  useEffect(
    () => () => {
      if (savedClearRef.current) clearTimeout(savedClearRef.current);
    },
    []
  );

  const bumpStart = () => {
    inFlightRef.current += 1;
    if (savedClearRef.current) {
      clearTimeout(savedClearRef.current);
      savedClearRef.current = null;
    }
    setState("saving");
  };

  const bumpEnd = () => {
    inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    if (inFlightRef.current === 0) {
      setState("saved");
      savedClearRef.current = setTimeout(() => {
        setState("idle");
        savedClearRef.current = null;
      }, 1800);
    }
  };

  const track = async <T,>(p: Promise<T>): Promise<T> => {
    bumpStart();
    try {
      return await p;
    } finally {
      bumpEnd();
    }
  };

  return { state, track };
}
