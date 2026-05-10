"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  initialContent?: unknown[];
};

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "upload failed");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function Editor({ initialContent }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useCreateBlockNote({
    initialContent: (initialContent && initialContent.length > 0
      ? initialContent
      : undefined) as never,
    uploadFile,
  });

  useEffect(() => {
    const save = async () => {
      setStatus("saving");
      try {
        const md = await editor.blocksToMarkdownLossy(editor.document);
        const res = await fetch("/api/page", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentJson: editor.document, contentMd: md }),
        });
        setStatus(res.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    };

    const onChange = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(save, 800);
    };

    return editor.onChange(onChange);
  }, [editor]);

  const lock = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/lock");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span>
          {status === "saving" && "saving…"}
          {status === "saved" && "saved"}
          {status === "error" && "save failed"}
        </span>
        <button
          type="button"
          onClick={lock}
          className="underline-offset-2 hover:underline"
        >
          lock
        </button>
      </div>
      <BlockNoteView editor={editor} theme="light" />
    </div>
  );
}
