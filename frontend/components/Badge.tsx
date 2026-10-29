export type BadgeTone = "good" | "warn" | "bad" | "accent" | "muted";

const TONE_STYLE: Record<BadgeTone, string> = {
  good: "bg-good/10 text-good",
  warn: "bg-warn/10 text-warn",
  bad: "bg-bad/10 text-bad",
  accent: "bg-accent/10 text-accent",
  muted: "bg-faint/15 text-faint",
};

export default function Badge({
  tone = "muted",
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${TONE_STYLE[tone]}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
