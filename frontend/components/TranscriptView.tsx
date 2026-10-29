import { TranscriptSegment } from "@/lib/api";

export default function TranscriptView({ segments, onJump }: { segments: TranscriptSegment[]; onJump: (t: number) => void }) {
  return (
    <div className="space-y-3 max-h-[560px] overflow-y-auto scrollbar-thin pr-1">
      {segments.map((s) => (
        <div key={s.sequence} className="flex gap-3 group">
          <button
            onClick={() => onJump(s.start_time)}
            className="shrink-0 font-mono text-[11px] text-faint hover:text-accent pt-0.5 w-12 text-right tabular"
          >
            {Math.floor(s.start_time / 60)}:{String(Math.floor(s.start_time % 60)).padStart(2, "0")}
          </button>
          <div className="flex-1 min-w-0">
            <span
              className={`text-[10px] uppercase tracking-wide font-medium mr-2 ${
                s.speaker_role === "agent" ? "text-accent" : "text-warn"
              }`}
            >
              {s.speaker_role}
            </span>
            <span className="text-[13px] text-ink leading-relaxed">{s.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
