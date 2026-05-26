import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { ExtensionTokens } from "@/components/extension-tokens";

export default async function SettingsPage() {
  await requireOwner("/settings");

  return (
    <main className="mx-auto max-w-2xl px-8 py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/portfolio"
          className="text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          ← Back
        </Link>
        <h1 className="text-[14px] font-semibold text-fg">Settings</h1>
        <span className="text-[12px] text-tertiary" />
      </header>

      <ExtensionTokens />
    </main>
  );
}
