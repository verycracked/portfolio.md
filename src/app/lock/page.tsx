"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const UnicornScene = dynamic(() => import("unicornstudio-react"), {
  ssr: false,
});

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
      <div className="pointer-events-none w-[280px] h-[180px]">
        <UnicornScene
          projectId="KsvQdy6ql75m1zkNeq6r"
          width="280px"
          height="180px"
          scale={1}
          dpi={1.5}
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.0/dist/unicornStudio.umd.js"
        />
      </div>
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
