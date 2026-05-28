"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CopySimple,
  Eye,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { EditableText } from "@/components/editable-text";
import { SaveStatusBadge, useSaveTracker } from "@/components/save-status";
import { slugify } from "@/lib/slug";

type Props = {
  viewId: string;
  viewSlug: string;
  viewName: string;
  greeting: string;
};

const SAVE_DEBOUNCE_MS = 500;

/**
 * Top strip of the view editor — inline-editable view name + URL slug,
 * greeting input, and the Preview / Share / Delete actions. Mirrors the
 * top-of-page chrome of the main page's SiteShell but with view-row
 * metadata instead of site settings.
 */
export function ViewEditorHeader({
  viewId,
  viewSlug,
  viewName,
  greeting,
}: Props) {
  const router = useRouter();
  const tracker = useSaveTracker();
  const [name, setName] = useState(viewName);
  const [slugDraft, setSlugDraft] = useState(viewSlug);
  const [slug, setSlug] = useState(viewSlug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [greetingDraft, setGreetingDraft] = useState(greeting);
  const [copied, setCopied] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  /** Generic patch save. Returns the server's response body so callers
   *  can sync back any server-derived fields (e.g. the slug that the
   *  server re-derives from a renamed `name`). */
  const debouncedSaveView = (
    patch: Record<string, unknown>,
    onSettled?: (updated: { slug?: string; name?: string }) => void
  ) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await tracker.track(
        fetch(`/api/views/${viewId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        })
      );
      if (!res.ok) return;
      if (onSettled) {
        const updated = (await res.json().catch(() => null)) as
          | { slug?: string; name?: string }
          | null;
        if (updated) onSettled(updated);
      }
    }, SAVE_DEBOUNCE_MS);
  };

  const updateName = (next: string) => {
    setName(next);
    // Server auto-derives a new slug from the renamed view. Mirror it
    // back into local state so the slug-input below the h1 and the
    // share URL stay in lock-step with what visitors will see.
    debouncedSaveView({ name: next }, (updated) => {
      if (updated.slug && updated.slug !== slug) {
        setSlug(updated.slug);
        setSlugDraft(updated.slug);
      }
    });
  };

  const updateGreeting = (next: string) => {
    setGreetingDraft(next);
    debouncedSaveView({ greeting: next });
  };

  const commitSlug = async () => {
    const cleaned = slugify(slugDraft);
    if (!cleaned) {
      setSlugError("slug can't be empty");
      setSlugDraft(slug);
      return;
    }
    if (cleaned === slug) {
      setSlugDraft(cleaned);
      setSlugError(null);
      return;
    }
    const res = await tracker.track(
      fetch(`/api/views/${viewId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: cleaned }),
      })
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSlugError(data.error ?? `failed (${res.status})`);
      setSlugDraft(slug);
      return;
    }
    const updated = (await res.json()) as { slug?: string };
    const final = updated.slug ?? cleaned;
    setSlugError(null);
    setSlug(final);
    setSlugDraft(final);
  };

  const copyShareLink = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/v/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this share link:", url);
    }
  };

  const deleteView = async () => {
    if (!confirm(`Delete "${name}"? Shared links will 404.`)) return;
    const res = await fetch(`/api/views/${viewId}`, { method: "DELETE" });
    if (res.ok) router.push("/views");
  };

  return (
    <header className="flex flex-col gap-4">
      <Link
        href="/views"
        className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
      >
        <ArrowLeft size={11} weight="bold" aria-hidden />
        Back to views
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <EditableText
            value={name}
            onChange={updateName}
            placeholder="View name"
            as="h1"
            className="text-[28px] font-semibold tracking-tight text-fg"
          />
          <div className="flex items-center gap-1 text-[12px] text-tertiary">
            <span aria-hidden>/v/</span>
            <input
              value={slugDraft}
              onChange={(e) => {
                setSlugDraft(e.target.value);
                if (slugError) setSlugError(null);
              }}
              onBlur={() => void commitSlug()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
                if (e.key === "Escape") {
                  setSlugDraft(slug);
                  setSlugError(null);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              aria-label="View URL slug"
              className="w-[12rem] bg-transparent text-[12px] text-muted outline-none placeholder:text-tertiary focus:text-fg"
              spellCheck={false}
            />
            {slugError && (
              <span className="text-[11px] text-rose-400" role="alert">
                {slugError}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <SaveStatusBadge state={tracker.state} />
          <a
            href={`/v/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/80 px-2 py-1 text-muted hover:border-border hover:text-fg"
          >
            <Eye size={11} weight="bold" aria-hidden />
            Preview
          </a>
          <button
            type="button"
            onClick={() => void copyShareLink()}
            className="inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/80 px-2 py-1 text-muted hover:border-border hover:text-fg"
          >
            {copied ? (
              <>
                <Check size={11} weight="bold" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <CopySimple size={11} weight="bold" aria-hidden />
                Share
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void deleteView()}
            title="Delete view"
            className="inline-flex items-center rounded-[4px] border border-border-soft bg-content/80 px-2 py-1 text-tertiary hover:border-border hover:text-rose-400"
          >
            <Trash size={11} weight="bold" aria-hidden />
          </button>
        </div>
      </div>

      {/* Greeting input — banner at the top of the public view. */}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.06em] text-tertiary">
          Greeting
        </span>
        <EditableText
          value={greetingDraft}
          onChange={updateGreeting}
          placeholder="Optional — what the visitor sees as a banner at the top of this view"
          multiline
          as="div"
          className="min-h-[2.25rem] text-[13px] text-fg"
        />
      </div>
    </header>
  );
}
