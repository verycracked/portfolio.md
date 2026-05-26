"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  projectId: string;
  title: string;
  description: string;
};

export function ProjectUnlock({ projectId, title, description }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Wrong password.");
      setShake((n) => n + 1);
      return;
    }
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <Link
        href="/portfolio.md"
        className="animate-fade-in text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
      >
        ← Back
      </Link>

      <header
        className="animate-fade-rise mt-8"
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <p className="text-[12px] text-tertiary">Protected</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.018em] text-fg">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[13px] text-muted">{description}</p>
        )}
      </header>

      <form
        key={shake}
        onSubmit={submit}
        className={`animate-fade-rise mt-10 flex max-w-sm flex-col gap-3 rounded-[8px] border border-border bg-content p-5 ${shake ? "animate-nudge-x" : ""}`}
        style={{ ["--reveal-delay" as string]: "160ms" }}
      >
        <p className="text-[13px] text-muted">
          Enter the password to view this project.
        </p>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-[6px] border border-border bg-content px-3 py-2 text-fg outline-none transition-colors placeholder:text-tertiary focus:border-fg"
        />
        {error && <p className="text-[12px] text-muted">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="rounded-[6px] bg-fg px-4 py-2 text-[13px] font-medium text-content transition-opacity disabled:opacity-40"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
