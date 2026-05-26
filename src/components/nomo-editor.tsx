"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X } from "@phosphor-icons/react/dist/ssr";
import { NomoMarkdown } from "@/lib/nomo-markdown";
import type { ProjectSummary } from "@/lib/case-study";

type Props = {
  slug: string;
  initialRaw: string;
  avatarUrl: string | null;
  caseStudies: Map<string, ProjectSummary>;
};

type LinkDraft = {
  /** Char index in `raw` where `<` was found. */
  start: number;
  /** Char index where `>` was found (inclusive of the angle bracket). */
  end: number;
  /** Text between < and >. */
  label: string;
};

type LinkStyle = "pill" | "underline";

const SAVE_DEBOUNCE_MS = 700;

/**
 * Owner-facing editor for a nomo-style markdown document. Two columns: the
 * raw source on the left (textarea), live preview on the right. Wrapping any
 * text in `<…>` opens a small popover where the owner picks a URL + a style
 * (pill or underline); confirming rewrites the `<text>` token to the
 * corresponding markdown — `(([text](url)))` or `[text](url)` — and the
 * preview updates instantly.
 *
 * Saves on a debounce after edits (700ms idle); the parent decides when to
 * leave edit mode.
 */
export function NomoEditor({
  slug,
  initialRaw,
  avatarUrl,
  caseStudies,
}: Props) {
  const [raw, setRaw] = useState(initialRaw);
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftStyle, setDraftStyle] = useState<LinkStyle>("pill");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Detect `<…>` token near the cursor each time the source changes or the
  // selection moves. Only one token is "in flight" at a time — we don't show
  // popovers for fully-resolved markdown already in the body.
  const detectDraft = (nextRaw: string, caretAt: number) => {
    const before = nextRaw.slice(0, caretAt);
    const lt = before.lastIndexOf("<");
    if (lt === -1) return setDraft(null);
    const gt = nextRaw.indexOf(">", lt);
    if (gt === -1) return setDraft(null);
    // Only consider tokens where the caret is inside or just past the closer.
    if (caretAt > gt + 1) return setDraft(null);
    const label = nextRaw.slice(lt + 1, gt).trim();
    // Skip empty `<>` or anything looking like an HTML tag (`<br>`, `<a …>`).
    if (!label || /[<>\n]/.test(label) || label.includes("/")) {
      return setDraft(null);
    }
    setDraft({ start: lt, end: gt, label });
    setDraftUrl(""); // reset URL for each new token detection cycle
  };

  // Persist on a debounce so typing isn't blocked by network round-trips.
  useEffect(() => {
    if (raw === initialRaw) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/pages/${slug}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: raw }),
        });
        if (res.ok) setSavedAt(new Date());
      } finally {
        setSaving(false);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [raw, initialRaw, slug]);

  const insertLink = () => {
    if (!draft || !taRef.current) return;
    const url = draftUrl.trim();
    if (!url) return;
    const replacement =
      draftStyle === "pill"
        ? `(([${draft.label}](${url})))`
        : `[${draft.label}](${url})`;
    const next = raw.slice(0, draft.start) + replacement + raw.slice(draft.end + 1);
    const nextCaret = draft.start + replacement.length;
    setRaw(next);
    setDraft(null);
    // Re-focus textarea and put cursor after the inserted markdown.
    queueMicrotask(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const cancelDraft = () => setDraft(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-3 text-[11px] text-tertiary">
        {saving ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Live"}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Source */}
        <div className="relative flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-wide text-tertiary">
            Source
          </label>
          <textarea
            ref={taRef}
            value={raw}
            onChange={(e) => {
              const v = e.target.value;
              setRaw(v);
              detectDraft(v, e.target.selectionStart ?? v.length);
            }}
            onClick={(e) => {
              const t = e.currentTarget;
              detectDraft(t.value, t.selectionStart ?? 0);
            }}
            onKeyUp={(e) => {
              const t = e.currentTarget;
              detectDraft(t.value, t.selectionStart ?? 0);
            }}
            className="min-h-[480px] w-full resize-y rounded-[6px] border border-border bg-content p-3 font-mono text-[12.5px] leading-[1.6] text-fg outline-none focus:border-fg"
            spellCheck={false}
          />

          <AnimatePresence>
            {draft && (
              <motion.div
                role="dialog"
                aria-label="Insert link"
                className="double-stroke absolute inset-x-0 bottom-2 z-20 mx-2 rounded-[8px] bg-content p-2.5"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 2 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="relative z-[1] flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <span>Link</span>
                    <code className="rounded-[4px] bg-hover px-1.5 py-0.5 font-mono text-[11px] text-fg">
                      {draft.label}
                    </code>
                    <span className="ml-auto text-tertiary">
                      {draftStyle === "pill" ? "→ pill" : "→ underline"}
                    </span>
                  </div>
                  <input
                    autoFocus
                    type="url"
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        insertLink();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelDraft();
                      }
                    }}
                    placeholder="https://… or /projects/…"
                    className="w-full rounded-[5px] border border-border bg-hover px-2 py-1.5 text-[12px] text-fg outline-none placeholder:text-tertiary focus:border-fg"
                  />
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <StyleButton
                      label="Pill"
                      active={draftStyle === "pill"}
                      onClick={() => setDraftStyle("pill")}
                    />
                    <StyleButton
                      label="Underline"
                      active={draftStyle === "underline"}
                      onClick={() => setDraftStyle("underline")}
                    />
                    <button
                      type="button"
                      onClick={insertLink}
                      disabled={!draftUrl.trim()}
                      className="ml-auto inline-flex items-center gap-1 rounded-[5px] bg-fg px-2 py-1 text-[11px] font-medium text-content transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      <Check weight="bold" size={10} aria-hidden />
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={cancelDraft}
                      aria-label="Cancel"
                      className="inline-flex items-center justify-center rounded-[5px] bg-hover p-1 text-tertiary hover:bg-border hover:text-fg"
                    >
                      <X weight="bold" size={10} aria-hidden />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-wide text-tertiary">
            Preview
          </label>
          <div className="rounded-[6px] border border-border-soft bg-bg p-4">
            <NomoMarkdown
              body={stripFrontmatter(raw)}
              context={{ avatarUrl, caseStudies }}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-tertiary">
        Wrap any text in <code className="rounded bg-hover px-1 font-mono">&lt;…&gt;</code>{" "}
        to attach a link: a popover will ask for the URL and let you pick pill
        or underline.
      </p>
    </div>
  );
}

function StyleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-[5px] bg-fg px-2 py-1 font-medium text-content"
          : "rounded-[5px] bg-hover px-2 py-1 text-muted hover:bg-border hover:text-fg"
      }
    >
      {label}
    </button>
  );
}

/** Trim the YAML frontmatter before handing the body to the preview
 *  renderer. The renderer expects body only, not the leading `---` block. */
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4).replace(/^\n+/, "");
}
