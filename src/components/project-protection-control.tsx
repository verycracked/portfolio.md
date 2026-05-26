"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type Props = {
  projectId: string;
  isProtected: boolean;
  onChange: (isProtected: boolean) => void;
};

/**
 * Password-protection controls for a project. Lives next to "Delete project"
 * in the editor's status row. Encapsulates the popover/UX so ProjectForm
 * stays focused on layout + surface state.
 */
export function ProjectProtectionControl({
  projectId,
  isProtected,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (raw: string | null) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: raw }),
      });
      if (res.ok) {
        onChange(!!raw);
        setOpen(false);
        setPassword("");
      }
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setPassword("");
  };

  return (
    <div className="relative flex items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted underline-offset-2 hover:text-fg hover:underline"
      >
        {isProtected ? "Change password" : "Add password"}
      </button>
      {isProtected && (
        <button
          type="button"
          onClick={() => save(null)}
          disabled={busy}
          className="text-tertiary underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
        >
          Make public
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              onClick={close}
              className="fixed inset-0 z-40 bg-fg/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.25, 1, 0.5, 1] }}
            />
            <motion.div
              className="absolute left-0 top-full z-50 mt-2 w-[260px] origin-top-left rounded-[8px] border border-border-soft bg-content/80 p-3 shadow-lg backdrop-blur-md"
              role="dialog"
              aria-label="Set project password"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -2, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="mb-2 text-[11px] text-tertiary">
                {isProtected
                  ? "Change the password visitors need to view this project."
                  : "Visitors will need this password to view this project."}
              </p>
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save(password);
                  if (e.key === "Escape") close();
                }}
                placeholder="New password"
                className="w-full rounded-[6px] border border-border bg-content px-2 py-1.5 text-[13px] text-fg outline-none placeholder:text-tertiary focus:border-fg"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="text-[12px] text-tertiary underline-offset-2 hover:text-fg hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save(password)}
                  disabled={busy || !password}
                  className="rounded-[6px] bg-fg px-3 py-1 text-[12px] font-medium text-content disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
