"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LockPage() {
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
    <main className="flex min-h-[calc(100vh-1rem)] flex-col items-center justify-center gap-10 px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/vc-logo.svg"
        alt=""
        className="animate-fade-rise w-[120px] opacity-80"
        style={{ ["--reveal-delay" as string]: "0ms" }}
      />
      <form
        key={shake}
        onSubmit={submit}
        className={`animate-fade-rise w-full max-w-[280px] ${shake ? "animate-nudge-x" : ""}`}
        style={{ ["--reveal-delay" as string]: "80ms" }}
      >
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password) submit(e);
          }}
          placeholder="Password"
          className="w-full rounded-[6px] border border-border-soft bg-transparent px-3 py-2.5 text-center text-[14px] text-fg outline-none transition-colors placeholder:text-tertiary focus:border-fg"
        />
        {error && (
          <p className="mt-3 text-center text-[12px] text-muted">{error}</p>
        )}
      </form>
    </main>
  );
}
