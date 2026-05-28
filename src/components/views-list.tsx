"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CopySimple,
  Eye,
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

/**
 * Row-based list of saved views. Each row links to /views/[id] for the
 * actual editor; quick actions inline are Preview (new tab), Copy link,
 * and Delete. The "+ New view" pill at the bottom creates a fresh view
 * (server-side seeds it with a snapshot of `/`) and routes to its
 * editor immediately so the owner can start curating.
 */
export function ViewsList({ initialViews }: Props) {
  const router = useRouter();
  const [views, setViews] = useState(initialViews);
  const [busy, setBusy] = useState(false);

  const addView = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "New view" }),
      });
      if (!res.ok) return;
      const created = (await res.json()) as ViewRow;
      router.push(`/views/${created.id}`);
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
  onDelete,
}: {
  view: ViewRow;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

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
    <article className="rounded-[6px] border border-border-soft bg-content/40">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href={`/views/${view.id}`}
          className="flex flex-1 flex-col items-start gap-0.5 text-left"
        >
          <span className="text-[14px] font-medium text-fg">{view.name}</span>
          <span className="text-[11px] text-tertiary">
            /v/{view.slug} · {summary}
          </span>
        </Link>
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
