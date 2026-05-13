"use client";

import { createElement, useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** When true, paste sanitizes to plain text */
  plainText?: boolean;
  className?: string;
  as?: "div" | "h1" | "h2" | "h3" | "p" | "span";
};

/**
 * Edit-in-place text. Renders as a semantic tag (heading, paragraph, etc.)
 * — visually identical to the published view but contentEditable.
 *
 * Pattern: render `value` as children for SSR + initial paint, then
 * suppressContentEditableWarning tells React not to reconcile children
 * (so the user's typing isn't clobbered on parent re-renders).
 *
 * External value changes (e.g. server response) are synced imperatively
 * via useEffect, but only when the element isn't focused — so we never
 * yank text out from under a typing user.
 */
export function EditableText({
  value,
  onChange,
  placeholder,
  multiline = false,
  plainText = true,
  className = "",
  as = "div",
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  // Set initial textContent on mount, then sync external value changes ONLY
  // when the user isn't actively editing. We never pass `value` as children
  // because that would make React reconcile and reset the caret on every keystroke.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof document !== "undefined" && document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  return createElement(as, {
    ref,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-placeholder": placeholder,
    onInput: (e: React.FormEvent<HTMLElement>) => {
      onChange(e.currentTarget.textContent ?? "");
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
      }
      if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
    },
    onPaste: (e: React.ClipboardEvent<HTMLElement>) => {
      if (!plainText) return;
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    },
    className: `editable outline-none ${className}`,
  });
}
