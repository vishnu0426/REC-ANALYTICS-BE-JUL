import { PauseEvent } from "@/lib/api";
import Badge, { BadgeTone } from "@/components/Badge";

const SEVERITY_TONE: Record<string, BadgeTone> = {
  notable: "warn",
  excessive: "bad",
};

export default function PauseList({ pauses, onJump }: { pauses: PauseEvent[]; onJump: (t: number) => void }) {
  if (pauses.length === 0) {
    return <p className="text-[12.5px] text-muted">No notable pauses detected in this call.</p>;
  }

  return (
    <div className="space-y-1.5">
      {pauses.map((p, i) => (
        <button
          key={i}
          onClick={() => onJump(p.start_time)}
          className="w-full flex items-center justify-between px-3 py-2 border border-hairline rounded-md text-left hover:border-faint transition-colors"
        >
          <span className="text-[12px] font-mono text-muted tabular">
            {Math.floor(p.start_time / 60)}:{String(Math.floor(p.start_time % 60)).padStart(2, "0")}
          </span>
          <span className="text-[12px] text-ink">
            {p.duration_seconds.toFixed(1)}s pause
            {p.preceding_speaker && p.following_speaker && (
              <span className="text-muted"> · {p.preceding_speaker} → {p.following_speaker}</span>
            )}
          </span>
          <Badge tone={SEVERITY_TONE[p.severity] || "muted"}>{p.severity}</Badge>
        </button>
      ))}
    </div>
  );
}
