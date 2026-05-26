"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LockPage() {
  // useSearchParams() must live under Suspense for Next 16's static export.
  return (
    <Suspense fallback={null}>
      <LockForm />
    </Suspense>
  );
}

function LockForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/login", {
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
    router.push(next);
    router.refresh();
  };

  return (
    <main className="flex min-h-[calc(100vh-1rem)] items-center justify-center px-6">
      <form
        key={shake}
        onSubmit={submit}
        className={`animate-fade-rise w-full max-w-[320px] rounded-[6px] border border-border bg-content p-5 ${shake ? "animate-nudge-x" : ""}`}
      >
        <h1 className="text-[14px] font-semibold text-fg">portfolio.md</h1>
        <p className="mt-1 mb-5 text-[13px] text-muted">Enter password to edit.</p>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-[6px] border border-border bg-content px-3 py-2 text-fg outline-none transition-colors placeholder:text-tertiary focus:border-fg"
        />
        {error && <p className="mt-2 text-[12px] text-muted">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full rounded-[6px] bg-fg px-4 py-2 text-[13px] font-medium text-content transition-opacity disabled:opacity-40"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
