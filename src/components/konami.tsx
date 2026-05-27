"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Classic Konami code: ↑ ↑ ↓ ↓ ← → ← → B A.
const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/**
 * Mounted once at the app root. Tracks the last N keypresses; when the
 * Konami sequence matches, routes the user to /playground. Inputs from
 * editable elements (typing into a textarea / contenteditable) are skipped
 * so the sequence doesn't fire while the owner is composing something.
 */
export function Konami() {
  const router = useRouter();

  useEffect(() => {
    const buffer: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t) {
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
        if (t.isContentEditable) return;
      }
      // Normalize letter keys to lowercase so the sequence accepts
      // shift-held inputs too. Arrow keys pass through verbatim.
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      buffer.push(key);
      // Trim from the front so we never compare more than the sequence.
      if (buffer.length > SEQUENCE.length) buffer.shift();
      if (buffer.length !== SEQUENCE.length) return;
      for (let i = 0; i < SEQUENCE.length; i++) {
        if (buffer[i] !== SEQUENCE[i]) return;
      }
      // Match — clear buffer so a second sequence requires the full input
      // again, then navigate.
      buffer.length = 0;
      router.push("/playground");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
