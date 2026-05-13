"use client";

import { useEffect, useState } from "react";

type Token = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function ExtensionTokens() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [label, setLabel] = useState("Snapshot extension");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return;
    const data = (await res.json()) as { tokens: Token[] };
    setTokens(data.tokens);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const mint = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { token } = (await res.json()) as { token: string };
      setNewToken(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mint token");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? Any client using it will stop working.")) return;
    await fetch(`/api/auth/token?id=${id}`, { method: "DELETE" });
    await refresh();
  };

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h3 className="text-[14px] font-semibold text-fg">Extension tokens</h3>
        <p className="mt-1 text-[12px] text-muted">
          Use these to authorize the Snapshot Chrome extension. Each token is
          shown once when minted.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 rounded-[6px] border border-border bg-content px-3 py-2 text-[13px] text-fg outline-none placeholder:text-tertiary focus:border-fg"
        />
        <button
          type="button"
          onClick={mint}
          disabled={busy || !label.trim()}
          className="rounded-[6px] bg-fg px-3 py-2 text-[12px] font-medium text-content disabled:opacity-40"
        >
          {busy ? "Minting…" : "New token"}
        </button>
      </div>

      {newToken && (
        <div className="flex flex-col gap-2 rounded-[6px] border border-border bg-content p-3">
          <p className="text-[12px] text-muted">
            Copy this token into the extension&apos;s options page. You won&apos;t
            see it again.
          </p>
          <code className="block break-all rounded-[4px] border border-border-soft bg-hover px-2 py-1.5 font-mono text-[12px] text-fg">
            {newToken}
          </code>
          <div className="flex gap-3 text-[12px]">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(newToken);
              }}
              className="text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setNewToken(null)}
              className="text-tertiary underline-offset-2 hover:text-fg hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-rose-600">{error}</p>}

      {tokens.length > 0 && (
        <ul className="divide-y divide-border-soft overflow-hidden rounded-[6px] border border-border bg-content">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between px-3 py-2 text-[12px]"
            >
              <div>
                <div className="text-fg">{t.label}</div>
                <div className="text-tertiary">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt
                    ? ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                    : " · never used"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revoke(t.id)}
                className="text-tertiary underline-offset-2 hover:text-fg hover:underline"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
