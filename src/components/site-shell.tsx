"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";

type Props = {
  avatarUrl: string | null;
  owner: boolean;
  children: ReactNode;
};

/**
 * Top-of-page chrome for the single unified site page.
 *
 * Owner-actions row (Edit / Done) sits top-right, the circular avatar
 * sits below it, and the rest of the page content is rendered as children.
 * Everything renders inside a fixed `max-w-3xl` column so the layout
 * doesn't shift depending on what's below.
 */
export function SiteShell({ avatarUrl, owner, children }: Props) {
  const searchParams = useSearchParams();
  const editing = searchParams.get("edit") === "1";
  const previewing = searchParams.get("preview") === "1";
  const editable = owner && !previewing && !editing;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 md:px-[3.75rem]">
      {owner && (
        <div className="animate-fade-in mb-6 flex min-h-[1.75rem] items-center justify-end gap-3 text-[12px]">
          {editing ? (
            <Link
              href="/"
              className="rounded-[6px] bg-fg px-3 py-1 text-[12px] font-medium text-content hover:opacity-90"
            >
              Done
            </Link>
          ) : (
            <Link
              href="/?edit=1"
              className="text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Edit
            </Link>
          )}
        </div>
      )}

      {(editable || avatarUrl) && (
        <div
          className="animate-fade-rise mb-10"
          style={{ ["--reveal-delay" as string]: "40ms" }}
        >
          <Avatar initialUrl={avatarUrl} editable={editable} />
        </div>
      )}

      {children}
    </main>
  );
}
