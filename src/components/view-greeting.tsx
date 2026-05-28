/**
 * Short banner at the top of a shared View. Lets the owner write a
 * one-liner directed at whoever they sent the link to.
 */
export function ViewGreeting({ text }: { text: string }) {
  return (
    <div
      className="animate-fade-rise mb-8 rounded-[6px] border border-border-soft bg-content/60 px-4 py-3 text-[13px] text-fg"
      style={{ ["--reveal-delay" as string]: "20ms" }}
    >
      {text}
    </div>
  );
}
