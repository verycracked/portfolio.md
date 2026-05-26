"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Plus, X } from "@phosphor-icons/react/dist/ssr";
import { usePointerLight } from "@/lib/use-pointer-light";

export type EditableSurface = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  surfaces: EditableSurface[];
  activeId: string;
  onActivate: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

/**
 * Editor-mode tab bar: click a tab to switch, double-click to rename, hover
 * to reveal a delete affordance (hidden on the last remaining surface). The
 * "+" pill at the end adds a new surface. The active tab wears the
 * project-wide `.double-stroke` Paper-selection treatment and a pointer-
 * tracked highlight (same hook the home gallery cards use).
 */
export function SurfaceTabBarEditor({
  surfaces,
  activeId,
  onActivate,
  onAdd,
  onRename,
  onDelete,
}: Props) {
  return (
    <nav
      aria-label="Project surfaces"
      className="inline-flex flex-wrap items-center gap-1 rounded-[10px] border border-border-soft bg-content/60 p-1"
    >
      {surfaces.map((surface) => (
        <SurfaceTab
          key={surface.id}
          surface={surface}
          isActive={surface.id === activeId}
          canDelete={surfaces.length > 1}
          onActivate={() => onActivate(surface.id)}
          onRename={(name) => onRename(surface.id, name)}
          onDelete={() => onDelete(surface.id)}
        />
      ))}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add surface"
        className="ml-0.5 inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[12px] text-tertiary hover:bg-hover hover:text-fg"
      >
        <Plus weight="bold" size={12} aria-hidden />
        <span>New tab</span>
      </button>
    </nav>
  );
}

function SurfaceTab({
  surface,
  isActive,
  canDelete,
  onActivate,
  onRename,
  onDelete,
}: {
  surface: EditableSurface;
  isActive: boolean;
  canDelete: boolean;
  onActivate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(surface.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Only the active tab uses the Paper double-stroke + pointer light; inactive
  // tabs stay flat so the selection reads as the focal element.
  const light = usePointerLight();

  const startEdit = () => {
    setDraft(surface.name);
    setEditing(true);
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commit = () => {
    const next = draft.trim();
    if (next && next !== surface.name) onRename(next);
    setEditing(false);
  };

  return (
    <div
      {...(isActive ? light : {})}
      className={clsx(
        "group relative inline-flex items-center rounded-[8px] transition-colors",
        isActive
          ? "double-stroke bg-hover font-medium text-fg"
          : "text-muted hover:text-fg"
      )}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(surface.name);
              setEditing(false);
            }
          }}
          className="w-[120px] bg-transparent px-3 py-1.5 text-[12px] outline-none placeholder:text-tertiary"
          aria-label="Rename surface"
        />
      ) : (
        <button
          type="button"
          onClick={onActivate}
          onDoubleClick={startEdit}
          className="px-3 py-1.5 text-[12px]"
        >
          {surface.name}
        </button>
      )}
      {canDelete && !editing && (
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete the "${surface.name}" tab?`)) onDelete();
          }}
          aria-label={`Delete ${surface.name}`}
          className={clsx(
            // Collapsed by default (zero width, zero margin) so the tab is
            // only as wide as its name. On hover the close button eases out
            // to its full size, growing the tab to make room. Width is the
            // animated property; opacity rides along to avoid a flash of the
            // glyph while the cell is still 0px wide.
            "inline-flex h-4 items-center justify-center overflow-hidden rounded-[3px] opacity-0 transition-[width,margin,opacity] duration-150 ease-out",
            "w-0 group-hover:mr-1.5 group-hover:w-4 group-hover:opacity-100 focus-visible:mr-1.5 focus-visible:w-4 focus-visible:opacity-100",
            isActive
              ? "text-tertiary hover:bg-content hover:text-fg"
              : "text-tertiary hover:bg-hover hover:text-fg"
          )}
        >
          <X weight="bold" size={9} aria-hidden />
        </button>
      )}
    </div>
  );
}
