"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CopySimple,
  Eye,
  Plus,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import { EditableText } from "@/components/editable-text";

type ViewRow = {
  id: string;
  slug: string;
  name: string;
  greeting: string;
  showAbout: boolean;
  showProjects: boolean;
  projectIds: string[];
  groupIds: string[];
  createdAt: string;
};

type GroupRow = {
  id: string;
  name: string;
  projects: { id: string; title: string; slug: string }[];
};

type Props = {
  initialViews: ViewRow[];
  groups: GroupRow[];
};

const SAVE_DEBOUNCE_MS = 500;

/**
 * Owner-side editor for shareable Views. Top-level list with an "add"
 * pill at the end; clicking a card expands it inline so the owner can
 * adjust toggles, the greeting, and the project whitelist. Saves are
 * debounced and optimistic.
 */
export function ViewsManager({ initialViews, groups }: Props) {
  const [views, setViews] = useState(initialViews);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialViews[0]?.id ?? null
  );

  const addView = async () => {
    const res = await fetch("/api/views", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New view" }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as ViewRow;
    setViews((vs) => [
      {
        ...created,
        // Server sends back projectIds/groupIds as Json — coerce.
        projectIds: Array.isArray(created.projectIds) ? created.projectIds : [],
        groupIds: Array.isArray(created.groupIds) ? created.groupIds : [],
      },
      ...vs,
    ]);
    setExpandedId(created.id);
  };

  const patchView = (id: string, patch: Partial<ViewRow>) =>
    setViews((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const removeView = async (id: string) => {
    const view = views.find((v) => v.id === id);
    if (!view) return;
    if (!confirm(`Delete the "${view.name}" view? Shared links will 404.`)) {
      return;
    }
    setViews((vs) => vs.filter((v) => v.id !== id));
    if (expandedId === id) setExpandedId(null);
    await fetch(`/api/views/${id}`, { method: "DELETE" });
  };

  return (
    <div className="flex flex-col gap-3">
      {views.length === 0 && (
        <p className="text-[13px] text-muted">
          No views yet. Create one to start sharing curated portfolios.
        </p>
      )}

      {views.map((view) => (
        <ViewCard
          key={view.id}
          view={view}
          groups={groups}
          expanded={expandedId === view.id}
          onToggle={() =>
            setExpandedId((id) => (id === view.id ? null : view.id))
          }
          onPatch={(patch) => patchView(view.id, patch)}
          onDelete={() => void removeView(view.id)}
        />
      ))}

      <button
        type="button"
        onClick={() => void addView()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-border-soft py-3 text-[12px] text-tertiary hover:border-border hover:text-fg"
      >
        <Plus size={12} weight="bold" aria-hidden />
        New view
      </button>
    </div>
  );
}

function ViewCard({
  view,
  groups,
  expanded,
  onToggle,
  onPatch,
  onDelete,
}: {
  view: ViewRow;
  groups: GroupRow[];
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<ViewRow>) => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    []
  );

  // Debounced server save. Always sends the *current* patched shape so
  // we never drop a field if the user makes several edits in a row.
  const persist = (patch: Partial<ViewRow>) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void fetch(`/api/views/${view.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const update = (patch: Partial<ViewRow>) => {
    onPatch(patch);
    persist(patch);
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

  const toggleProject = (id: string) => {
    const next = view.projectIds.includes(id)
      ? view.projectIds.filter((x) => x !== id)
      : [...view.projectIds, id];
    update({ projectIds: next });
  };

  const toggleGroup = (id: string) => {
    const next = view.groupIds.includes(id)
      ? view.groupIds.filter((x) => x !== id)
      : [...view.groupIds, id];
    update({ groupIds: next });
  };

  // Summary copy for the collapsed state — telegraphs the view's
  // configuration without making the owner expand it first.
  const summary: string[] = [];
  if (view.showAbout) summary.push("about");
  if (view.showProjects) summary.push("projects");
  if (view.projectIds.length > 0) {
    summary.push(`${view.projectIds.length} project${view.projectIds.length === 1 ? "" : "s"}`);
  }
  if (view.groupIds.length > 0) {
    summary.push(`${view.groupIds.length} group${view.groupIds.length === 1 ? "" : "s"}`);
  }
  if (summary.length === 0) summary.push("empty");

  return (
    <article className="rounded-[6px] border border-border-soft bg-content/40">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 flex-col items-start gap-0.5 text-left"
        >
          <span className="text-[14px] font-medium text-fg">{view.name}</span>
          <span className="text-[11px] text-tertiary">
            /v/{view.slug} · {summary.join(" · ")}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <a
            href={`/v/${view.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] text-muted hover:bg-hover hover:text-fg"
          >
            <Eye size={11} weight="bold" aria-hidden />
            Open
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

      {expanded && (
        <div className="flex flex-col gap-5 border-t border-border-soft px-4 py-4">
          {/* Name */}
          <Field label="Name">
            <EditableText
              value={view.name}
              onChange={(v) => update({ name: v })}
              placeholder="e.g. Hiring managers"
              as="div"
              className="text-[13px] text-fg"
            />
          </Field>

          {/* Greeting */}
          <Field
            label="Greeting"
            hint="Optional. Shown as a banner at the top of the view."
          >
            <EditableText
              value={view.greeting}
              onChange={(v) => update({ greeting: v })}
              placeholder="Hi Sarah, here's a curated look at my work"
              multiline
              as="div"
              className="min-h-[2rem] text-[13px] text-fg"
            />
          </Field>

          {/* Section toggles */}
          <Field label="Sections">
            <div className="flex flex-col gap-2">
              <Toggle
                label="Show about (intro markdown + avatar)"
                checked={view.showAbout}
                onChange={(showAbout) => update({ showAbout })}
              />
              <Toggle
                label="Show projects gallery"
                checked={view.showProjects}
                onChange={(showProjects) => update({ showProjects })}
              />
            </div>
          </Field>

          {/* Group whitelist */}
          {view.showProjects && groups.length > 0 && (
            <Field
              label="Groups"
              hint="Empty = include all groups. Otherwise only the picked groups render."
            >
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const on = view.groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={
                        on
                          ? "rounded-[4px] border border-border bg-fg/[0.12] px-2 py-1 text-[11px] text-fg"
                          : "rounded-[4px] border border-border-soft px-2 py-1 text-[11px] text-muted hover:border-border hover:text-fg"
                      }
                    >
                      {g.name || "Untitled"}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {/* Project whitelist */}
          {view.showProjects && (
            <Field
              label="Projects"
              hint="Empty = include all. Otherwise only the picked projects render in their original groups."
            >
              <div className="flex flex-col gap-3">
                {groups.map((g) => (
                  <div key={g.id} className="flex flex-col gap-1.5">
                    <span className="text-[11px] uppercase tracking-[0.06em] text-tertiary">
                      {g.name || "Untitled"}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {g.projects.length === 0 ? (
                        <span className="text-[11px] text-tertiary">
                          (no projects in this group)
                        </span>
                      ) : (
                        g.projects.map((p) => {
                          const on = view.projectIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleProject(p.id)}
                              className={
                                on
                                  ? "rounded-[4px] border border-border bg-fg/[0.12] px-2 py-1 text-[11px] text-fg"
                                  : "rounded-[4px] border border-border-soft px-2 py-1 text-[11px] text-muted hover:border-border hover:text-fg"
                              }
                            >
                              {p.title}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          )}
        </div>
      )}
    </article>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.06em] text-tertiary">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-tertiary">{hint}</span>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-fg"
      />
      <span>{label}</span>
    </label>
  );
}
