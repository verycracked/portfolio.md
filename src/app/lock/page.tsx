"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LockPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/edit";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setError("wrong password");
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 dark:bg-stone-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
      >
        <h1 className="text-lg font-medium">portfolio.md</h1>
        <p className="mt-1 mb-6 text-sm text-stone-500">enter password to edit</p>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="w-full rounded-md border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-500 dark:border-stone-700"
        />
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          {busy ? "checking…" : "unlock"}
        </button>
      </form>
    </main>
  );
}
