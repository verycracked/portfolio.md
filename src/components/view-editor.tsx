"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CopySimple,
  Eye,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/avatar";
import { EditableText } from "@/components/editable-text";
import { Gallery } from "@/components/gallery";
import { NomoEditor } from "@/components/nomo-editor";
import { SaveStatusBadge, useSaveTracker } from "@/components/save-status";
import { slugify } from "@/lib/slug";
import type { GalleryGroup } from "@/components/gallery-types";
import type { ProjectSummary } from "@/lib/case-study";

type Props = {
  viewId: string;
  viewSlug: string;
  viewName: string;
  greeting: string;
  aboutBody: string;
  avatarUrl: string | null;
  groups: GalleryGroup[];
  caseStudies: Map<string, ProjectSummary>;
};

const SAVE_DEBOUNCE_MS = 500;

/**
 * Per-view homepage editor. Renders the same shape as `/` (header with
 * avatar, markdown intro, gallery sections) but every mutation routes
 * to the view-scoped APIs. The owner can drag, resize, rename, upload —
 * and nothing they do here changes the main `/` or any other view.
 *
 * Top of page: inline-editable view name and `/v/<slug>` URL, plus Share
 * link / Delete buttons. Greeting input below that — what visitors see
 * as a banner at the top of the public view.
 */
export function ViewEditor({
  viewId,
  viewSlug,
  viewName,
  greeting,
  aboutBody,
  avatarUrl,
  groups,
  caseStudies,
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

  const debouncedSaveView = (patch: Record<string, unknown>) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void tracker.track(
        fetch(`/api/views/${viewId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        })
      );
    }, SAVE_DEBOUNCE_MS);
  };

  const updateName = (next: string) => {
    setName(next);
    debouncedSaveView({ name: next });
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

  // Per-view markdown save — replaces the canonical /api/pages/[slug]
  // path the NomoEditor uses by default.
  const saveAboutBody = useMemo(
    () => async (raw: string) => {
      const res = await tracker.track(
        fetch(`/api/views/${viewId}/about`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ aboutBody: raw }),
        })
      );
      return res.ok;
    },
    [viewId, tracker]
  );

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
    <div className="flex flex-col gap-10">
      {/* Header strip — view metadata + share/delete actions. */}
      <header className="mt-8 flex flex-col gap-3">
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

        {/* Greeting input — what visitors see as a banner at the top. */}
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

      {/* About block — per-view markdown editor. Inline NomoEditor with
          the live preview side-by-side. Saves to View.aboutBody. */}
      <section className="flex flex-col gap-3">
        <span className="text-[11px] uppercase tracking-[0.06em] text-tertiary">
          About
        </span>
        <Avatar initialUrl={avatarUrl} editable />
        <NomoEditor
          slug={`view:${viewId}`}
          initialRaw={aboutBody}
          avatarUrl={avatarUrl}
          caseStudies={caseStudies}
          onSave={saveAboutBody}
        />
      </section>

      {/* Gallery — view-scoped reads/writes. Tile click-through is
          disabled because per-view slugs aren't canonical Project slugs. */}
      <section id="portfolio" className="scroll-mt-8">
        <Gallery
          initial={groups}
          owner
          scope={{ kind: "view", viewId }}
          disableLinks
        />
      </section>
    </div>
  );
}
