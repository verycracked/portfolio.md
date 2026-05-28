"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { usePreviewing, withPreview } from "@/lib/preview";

/**
 * Back link from any project surface tab to the homepage. Lives in the
 * /projects/[slug] layout so it survives tab switches. Threads
 * `?preview=1` through when the owner is in preview mode.
 */
export function ProjectBackLink() {
  const previewing = usePreviewing();
  return (
    <Link
      href={withPreview("/", previewing)}
      className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
    >
      <ArrowLeft size={11} weight="bold" aria-hidden />
      Back
    </Link>
  );
}
