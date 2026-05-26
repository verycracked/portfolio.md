"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = {
  initialUrl: string | null;
  /** Controls the upload/remove UX. False renders a static image (visitor
   *  view) — owners pass `false` when previewing the public-facing site. */
  editable: boolean;
};

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload failed");
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function Avatar({ initialUrl, editable }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);

  const setAvatar = async (next: string | null) => {
    setUrl(next);
    setBusy(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatarUrl: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (file: File) => {
    setBusy(true);
    try {
      const uploaded = await uploadFile(file);
      await setAvatar(uploaded);
    } catch {
      setBusy(false);
    }
  };

  if (!editable) {
    if (!url) return null;
    return (
      <div className="size-16 overflow-hidden rounded-full border border-border bg-content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  const handleClick = () => {
    if (url) {
      setAvatar(null);
    } else {
      inputRef.current?.click();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="group relative size-16 overflow-hidden rounded-full border border-border bg-content disabled:opacity-60"
        aria-label={url ? "Remove avatar" : "Upload avatar"}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[11px] text-tertiary">
            Photo
          </span>
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-fg/60 text-[11px] font-medium text-content opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? "…" : url ? "Remove" : "Upload"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
