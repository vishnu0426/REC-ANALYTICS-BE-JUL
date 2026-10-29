import { ProcessingJob } from "@/lib/api";
import Badge, { BadgeTone } from "@/components/Badge";

const STAGE_LABEL: Record<string, string> = {
  speech: "Transcription",
  llm: "LLM Analysis",
  qa: "QA Scoring",
  compliance: "Compliance Check",
  analytics: "Analytics",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  succeeded: "good",
  failed: "bad",
  running: "accent",
  retrying: "warn",
  queued: "muted",
};

export default function ProcessingTimeline({ jobs }: { jobs: ProcessingJob[] }) {
  if (jobs.length === 0) {
    return <p className="text-[12.5px] text-muted">No per-stage timing recorded for this call.</p>;
  }

  const total = jobs.reduce((sum, j) => sum + (j.duration_seconds || 0), 0);

  return (
    <div className="space-y-1.5">
      {jobs.map((j, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2 border border-hairline rounded-md">
          <span className="text-[12.5px] text-ink">{STAGE_LABEL[j.stage] || j.stage}</span>
          <div className="flex items-center gap-2.5">
            <Badge tone={STATUS_TONE[j.status] || "muted"}>{j.status}</Badge>
            <span className="font-mono text-[12px] text-muted tabular w-14 text-right">
              {j.duration_seconds != null ? `${j.duration_seconds.toFixed(1)}s` : "—"}
            </span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-3 pt-1.5 text-[12px] text-faint">
        <span>Total (tracked stages)</span>
        <span className="font-mono tabular">{total.toFixed(1)}s</span>
      </div>
    </div>
  );
}
