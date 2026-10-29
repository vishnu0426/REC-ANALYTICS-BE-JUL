export default function MetricCard({
  label,
  value,
  sublabel,
  accent = "default",
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "good" | "warn" | "bad";
}) {
  const accentColor = {
    default: "text-ink",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
  }[accent];

  return (
    <div className="bg-panel border border-hairline rounded-lg px-5 py-4 flex-1 min-w-[150px]">
      <div className="text-[11px] uppercase tracking-wider text-faint font-medium mb-2">
        {label}
      </div>
      <div className={`font-mono text-[26px] leading-none font-medium tabular ${accentColor}`}>
        {value}
      </div>
      {sublabel && <div className="text-[12px] text-muted mt-1.5">{sublabel}</div>}
    </div>
  );
}
