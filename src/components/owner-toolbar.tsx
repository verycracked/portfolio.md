"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePreviewing } from "@/lib/preview";
import {
  Check,
  Eye,
  EyeSlash,
  Gear,
  Link as LinkIcon,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Owner-only top-right toolbar with three actions:
 *
 *  • Preview / Exit preview — toggles `?preview=1` on the current URL.
 *    Preview mode renders the page exactly as visitors see it (no edit
 *    chrome, drop zones, drag handles, etc.) without logging the owner out.
 *  • Share link — copies the preview URL to the clipboard. The preview URL
 *    is what visitors land on; sharing the bare URL would land them on the
 *    owner view if they happen to be signed in.
 *  • Settings — opens /settings, which hosts the Chrome snapshot extension
 *    tokens and any other site-wide owner configuration.
 *
 * Renders nothing for visitors; gated on `owner` at the call site.
 */
export function OwnerToolbar() {
  const [copied, setCopied] = useState(false);
  // Read the current preview-mode flag from the URL bar so the toolbar
  // can live in a server layout without that information being threaded
  // down through props.
  const previewing = usePreviewing();
  // Toggle preview on the CURRENT path, not always `/`. Lets owners drop
  // in/out of visitor view without losing their place in the site.
  const pathname = usePathname() || "/";
  const togglePreviewHref = previewing
    ? pathname
    : `${pathname}?preview=1`;

  const copyShareLink = async () => {
    if (typeof window === "undefined") return;
    // Strip any existing `preview` param then add ours so the link is clean.
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    url.searchParams.set("preview", "1");
    // Stripping the search prefix from the toString isn't necessary; the
    // URL helper handles it. But we use origin + pathname + ?preview=1 to
    // keep the link tidy regardless of how the owner arrived here.
    const shareUrl = `${url.origin}${url.pathname}?preview=1`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: select-into-prompt so the owner can still grab the URL
      // when clipboard access is blocked.
      window.prompt("Copy this preview link:", shareUrl);
    }
  };

  return (
    <div
      className="animate-fade-in absolute right-5 top-5 z-20 flex items-center gap-1.5 text-[12px] md:right-[3.75rem] md:top-8"
      style={{ ["--reveal-delay" as string]: "20ms" }}
    >
      <Link
        href={togglePreviewHref}
        className="inline-flex items-center gap-1.5 rounded-[6px] border border-border-soft bg-content/80 px-2.5 py-1 text-muted backdrop-blur transition-colors hover:border-border hover:text-fg"
        aria-label={previewing ? "Exit preview" : "Preview as visitor"}
      >
        {previewing ? (
          <EyeSlash size={12} weight="bold" aria-hidden />
        ) : (
          <Eye size={12} weight="bold" aria-hidden />
        )}
        {previewing ? "Exit preview" : "Preview"}
      </Link>
      <button
        type="button"
        onClick={() => void copyShareLink()}
        aria-label="Copy share link"
        className="inline-flex items-center gap-1.5 rounded-[6px] border border-border-soft bg-content/80 px-2.5 py-1 text-muted backdrop-blur transition-colors hover:border-border hover:text-fg"
      >
        {copied ? (
          <>
            <Check size={12} weight="bold" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <LinkIcon size={12} weight="bold" aria-hidden />
            Share
          </>
        )}
      </button>
      <Link
        href="/settings"
        aria-label="Settings"
        title="Settings"
        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-[6px] border border-border-soft bg-content/80 text-muted backdrop-blur transition-colors hover:border-border hover:text-fg"
      >
        <Gear size={13} weight="bold" aria-hidden />
      </Link>
    </div>
  );
}
