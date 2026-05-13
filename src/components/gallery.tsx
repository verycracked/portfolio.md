"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Image as ImageIcon, Lock, Pencil, Plus } from "@phosphor-icons/react/dist/ssr";
import { EditableText } from "@/components/editable-text";
import { Avatar } from "@/components/avatar";
import { usePointerLight } from "@/lib/use-pointer-light";

export type GalleryProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string | null;
  isProtected: boolean;
};

export function Gallery({
  initial,
  owner,
  previewing = false,
  avatarUrl,
}: {
  initial: GalleryProject[];
  owner: boolean;
  previewing?: boolean;
  avatarUrl: string | null;
}) {
  // The "effective owner" controls editability. When previewing, treat the
  // session as if it were a visitor — even though the cookie is still set.
  const editable = owner && !previewing;
  return (
    <main className="mx-auto max-w-3xl px-8 py-16">
      {(owner || avatarUrl) && (
        <div
          className="animate-fade-rise mb-8"
          style={{ ["--reveal-delay" as string]: "40ms" }}
        >
          <Avatar initialUrl={avatarUrl} owner={owner} />
        </div>
      )}
      <header
        className="animate-fade-rise mb-12 flex items-end justify-between"
        style={{ ["--reveal-delay" as string]: "120ms" }}
      >
        <div>
          <h1 className="text-[14px] font-semibold text-fg">Projects</h1>
          <p className="mt-1 text-[13px] text-muted">
            A collection of things I&apos;ve made.
          </p>
        </div>
        {owner && <OwnerHeaderActions previewing={previewing} />}
      </header>

      {initial.length === 0 && !editable ? (
        <div
          className="animate-fade-rise rounded-[8px] border border-border bg-content px-6 py-16 text-center"
          style={{ ["--reveal-delay" as string]: "200ms" }}
        >
          <p className="text-[13px] text-muted">No projects yet.</p>
        </div>
      ) : (
        <div className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2">
          {initial.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-rise"
              style={{ ["--reveal-delay" as string]: `${200 + i * 60}ms` }}
            >
              <Card project={p} owner={editable} />
            </div>
          ))}
          {editable && (
            <div
              className="animate-fade-rise"
              style={{
                ["--reveal-delay" as string]: `${200 + initial.length * 60}ms`,
              }}
            >
              <NewProjectCard />
            </div>
          )}
        </div>
      )}

    </main>
  );
}

function OwnerHeaderActions({ previewing }: { previewing: boolean }) {
  return (
    <div className="flex items-center gap-4 text-[12px]">
      {previewing ? (
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-fg underline-offset-2 hover:underline"
        >
          <Pencil weight="fill" size={12} aria-hidden />
          Edit
        </Link>
      ) : (
        <>
          <Link
            href="/settings"
            className="text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Settings
          </Link>
          <Link
            href="/?preview=1"
            className="text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Preview ↗
          </Link>
        </>
      )}
    </div>
  );
}

/* Outer card shell — matches the Paper selection:
 *   - 1px ring border (single ring shadow on top of bg)
 *   - 4px inner padding around hero
 *   - Text block padded 12px block / 16px inline
 */
function CardShell({ children }: { children: React.ReactNode }) {
  const light = usePointerLight();
  return (
    <div
      {...light}
      className="double-stroke flex h-full flex-col overflow-hidden rounded-[8px] bg-hover"
    >
      <div className="relative z-[1] flex flex-1 flex-col gap-1 p-1">
        {children}
      </div>
    </div>
  );
}

function Card({ project, owner }: { project: GalleryProject; owner: boolean }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const save = (patch: Partial<{ title: string; description: string }>) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      // NOTE: do NOT router.refresh() here — it refetches server data and
      // clobbers characters the user is still typing.
    }, 500);
  };

  if (!owner) {
    return (
      <Link href={`/projects/${project.slug}`} className="group block h-full">
        <CardShell>
          <HeroFrame
            url={project.heroImageUrl}
            title={project.title}
            protected={project.isProtected}
          />
          <div className="flex flex-1 flex-col px-4 py-3">
            <h2 className="text-[14px] font-medium text-fg">{project.title}</h2>
            {project.description && (
              <p className="mt-1 text-[13px] text-muted">{project.description}</p>
            )}
          </div>
        </CardShell>
      </Link>
    );
  }

  return (
    <div className="group h-full">
      <CardShell>
        <Link href={`/projects/${project.slug}`} className="relative block">
          <HeroFrame
            url={project.heroImageUrl}
            title={project.title}
            protected={project.isProtected}
          />
          <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/90 px-2 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
            Open
            <ArrowUpRight weight="fill" size={10} aria-hidden />
          </span>
        </Link>
        <div className="flex flex-1 flex-col gap-1 px-4 py-3">
          <EditableText
            value={title}
            onChange={(v) => {
              setTitle(v);
              save({ title: v });
            }}
            placeholder="Untitled project"
            className="text-[14px] font-medium text-fg"
            as="h2"
          />
          <EditableText
            value={description}
            onChange={(v) => {
              setDescription(v);
              save({ description: v });
            }}
            placeholder="Short description"
            className="text-[13px] text-muted"
            as="p"
          />
        </div>
      </CardShell>
    </div>
  );
}

function HeroFrame({
  url,
  title,
  protected: isProtected,
}: {
  url: string | null;
  title: string;
  protected?: boolean;
}) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-[6px] border border-border bg-hover">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={title}
          loading="lazy"
          onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
          className="img-fade h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-tertiary">
          <ImageIcon size={28} weight="fill" aria-label="No image" />
        </div>
      )}
      {isProtected && (
        <span
          aria-label="Protected"
          title="Password protected"
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[4px] border border-border-soft bg-content/95 px-2 py-0.5 text-[11px] text-muted"
        >
          <Lock weight="fill" size={11} aria-hidden />
          Locked
        </span>
      )}
    </div>
  );
}

function NewProjectCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled project" }),
    });
    setBusy(false);
    if (!res.ok) return;
    const project = (await res.json()) as { id: string };
    router.push(`/edit/${project.id}`);
  };

  return (
    <button
      type="button"
      onClick={create}
      disabled={busy}
      className="group block h-full w-full text-left"
    >
      <CardShell>
        <div className="flex aspect-[16/10] items-center justify-center gap-1.5 rounded-[6px] border border-dashed border-border bg-hover text-[13px] text-muted transition-colors group-hover:border-fg group-hover:text-fg">
          {busy ? (
            "Creating…"
          ) : (
            <>
              <Plus weight="fill" size={14} aria-hidden />
              New project
            </>
          )}
        </div>
        <div className="flex flex-1 flex-col px-4 py-3">
          <h2 className="text-[14px] font-medium text-tertiary">Add a project</h2>
          <p className="mt-1 text-[13px] text-tertiary">
            Title, description, hero image, body.
          </p>
        </div>
      </CardShell>
    </button>
  );
}
