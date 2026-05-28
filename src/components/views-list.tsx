"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CopySimple,
  Eye,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr";

type ViewRow = {
  id: string;
  slug: string;
  name: string;
  greeting: string;
  groupCount: number;
  projectCount: number;
};

type Props = {
  initialViews: ViewRow[];
};

const SAVE_DEBOUNCE_MS = 500;

/**
 * Row-based list of saved views. Each row links to /views/[id] for the
 * full editor, but you can also rename inline by clicking the pencil
 * (or the name itself). Quick actions: Preview (new tab), Copy link,
 * Delete. The "+ New view" pill creates a fresh view and lands you on
 * its name field so you can title it immediately — no forced trip
 * through the editor for a one-line rename.
 */
export function ViewsList({ initialViews }: Props) {
  const [views, setViews] = useState(initialViews);
  const [busy, setBusy] = useState(false);
  // After a successful create, this id is set so the matching row mounts
  // in rename mode with the input focused + selected. Cleared once the
  // row reads it.
  const [autoEditId, setAutoEditId] = useState<string | null>(null);

  const addView = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Default name is "Untitled view" so the inline input pre-fills
        // with something clearly placeholder-y, not a real label.
        body: JSON.stringify({ name: "Untitled view" }),
      });
      if (!res.ok) return;
      const created = (await res.json()) as ViewRow;
      // Append to the top of the list and put the new row straight into
      // rename mode — owner can immediately tab away or click into the
      // editor when they're done.
      setViews((vs) => [
        {
          id: created.id,
          slug: created.slug,
          name: created.name,
          greeting: created.greeting ?? "",
          groupCount: 0,
          projectCount: 0,
        },
        ...vs,
      ]);
      setAutoEditId(created.id);
    } finally {
      setBusy(false);
    }
  };

  const removeView = async (id: string) => {
    const v = views.find((x) => x.id === id);
    if (!v) return;
    if (!confirm(`Delete "${v.name}"? Shared links will 404.`)) return;
    setViews((vs) => vs.filter((x) => x.id !== id));
    await fetch(`/api/views/${id}`, { method: "DELETE" });
  };

  const renameView = (id: string, name: string) => {
    setViews((vs) => vs.map((v) => (v.id === id ? { ...v, name } : v)));
  };

  return (
    <div className="flex flex-col gap-3">
      {views.length === 0 && (
        <p className="text-[13px] text-muted">
          No views yet. Create one to start curating.
        </p>
      )}

      {views.map((v) => (
        <ViewRowCard
          key={v.id}
          view={v}
          startEditing={autoEditId === v.id}
          onConsumeAutoEdit={() => setAutoEditId(null)}
          onRename={(name) => renameView(v.id, name)}
          onDelete={() => void removeView(v.id)}
        />
      ))}

      <button
        type="button"
        onClick={() => void addView()}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-border-soft py-3 text-[12px] text-tertiary hover:border-border hover:text-fg disabled:opacity-60"
      >
        <Plus size={12} weight="bold" aria-hidden />
        {busy ? "Creating…" : "New view"}
      </button>
    </div>
  );
}

function ViewRowCard({
  view,
  startEditing,
  onConsumeAutoEdit,
  onRename,
  onDelete,
}: {
  view: ViewRow;
  startEditing: boolean;
  onConsumeAutoEdit: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(view.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-open the rename input on freshly created rows so the owner can
  // type the real name right away.
  useEffect(() => {
    if (startEditing) {
      setEditing(true);
      onConsumeAutoEdit();
    }
  }, [startEditing, onConsumeAutoEdit]);

  // Select-all on focus so a quick type replaces the placeholder name.
  useEffect(() => {
    if (editing) {
      queueMicrotask(() => inputRef.current?.select());
    }
  }, [editing]);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  const persistName = (next: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void fetch(`/api/views/${view.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const commitName = () => {
    const next = draft.trim() || "Untitled view";
    setEditing(false);
    if (next !== view.name) {
      onRename(next);
      persistName(next);
    } else {
      setDraft(view.name);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(view.name);
  };

  const copyShareLink = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/v/${view.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this share link:", url);
    }
  };

  const summary = `${view.projectCount} project${view.projectCount === 1 ? "" : "s"} · ${view.groupCount} section${view.groupCount === 1 ? "" : "s"}`;

  return (
    <article className="group rounded-[6px] border border-border-soft bg-content/40">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-1 flex-col items-start gap-0.5">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitName();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              aria-label="Rename view"
              className="w-full bg-transparent text-[14px] font-medium text-fg outline-none placeholder:text-tertiary"
              placeholder="View name"
              autoFocus
              spellCheck={false}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href={`/views/${view.id}`}
                className="text-[14px] font-medium text-fg hover:underline"
              >
                {view.name}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDraft(view.name);
                  setEditing(true);
                }}
                aria-label="Rename"
                title="Rename"
                className="inline-flex items-center justify-center rounded-[4px] p-0.5 text-tertiary opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100"
              >
                <PencilSimple size={11} weight="bold" aria-hidden />
              </button>
            </div>
          )}
          <span className="text-[11px] text-tertiary">
            /v/{view.slug} · {summary}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={`/v/${view.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] text-muted hover:bg-hover hover:text-fg"
          >
            <Eye size={11} weight="bold" aria-hidden />
            Preview
          </a>
          <button
            type="button"
            onClick={() => void copyShareLink()}
            className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] text-muted hover:bg-hover hover:text-fg"
            title="Copy share link"
          >
            {copied ? (
              <>
                <Check size={11} weight="bold" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <CopySimple size={11} weight="bold" aria-hidden />
                Copy link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete view"
            className="inline-flex items-center rounded-[4px] px-2 py-1 text-[11px] text-tertiary hover:bg-hover hover:text-rose-400"
          >
            <Trash size={11} weight="bold" aria-hidden />
          </button>
        </div>
      </header>
    </article>
  );
}
