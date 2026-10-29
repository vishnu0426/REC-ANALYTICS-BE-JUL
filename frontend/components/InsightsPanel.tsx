import { Lightbulb } from "lucide-react";
import { AIObservation, CallInsight, Recommendation } from "@/lib/api";
import Badge, { BadgeTone } from "@/components/Badge";
import EmptyState from "@/components/EmptyState";

const PRIORITY_TONE: Record<string, BadgeTone> = {
  low: "muted",
  medium: "warn",
  high: "bad",
};

export default function InsightsPanel({
  insight,
  observations,
  recommendations,
  onJump,
}: {
  insight: CallInsight | null;
  observations: AIObservation[];
  recommendations: Recommendation[];
  onJump: (t: number) => void;
}) {
  if (!insight && observations.length === 0 && recommendations.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="No AI observations or recommendations yet"
        description="These appear once analysis for this call finishes."
      />
    );
  }

  return (
    <div className="space-y-6">
      {insight && (
        <div className="border border-hairline rounded-md px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {insight.main_topic && <Badge tone="accent">{insight.main_topic}</Badge>}
            {insight.outcome && (
              <Badge tone={insight.outcome === "resolved" ? "good" : "warn"}>
                {insight.outcome.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          {insight.executive_summary && (
            <p className="text-[13px] text-ink leading-relaxed mb-2">{insight.executive_summary}</p>
          )}
          {insight.root_cause && (
            <p className="text-[12.5px] text-muted leading-relaxed mb-2">
              <span className="text-faint uppercase text-[10.5px] tracking-wide font-medium mr-1.5">Root cause</span>
              {insight.root_cause}
            </p>
          )}
          {insight.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {insight.keywords.map((k) => (
                <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-panelRaised text-muted">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <div className="text-[13px] font-medium text-ink mb-2">Recommendations</div>
          <div className="space-y-2">
            {recommendations.map((r, i) => (
              <div key={i} className="border border-hairline rounded-md px-3.5 py-3 flex items-start gap-3">
                <Badge tone={PRIORITY_TONE[r.priority] || "muted"}>{r.priority}</Badge>
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-1">
                    {r.category.replace(/_/g, " ")}
                  </div>
                  <p className="text-[12.5px] text-ink leading-relaxed">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {observations.length > 0 && (
        <div>
          <div className="text-[13px] font-medium text-ink mb-2">Observations</div>
          <div className="space-y-2">
            {observations.map((o, i) => (
              <div key={i} className="border border-hairline rounded-md px-3.5 py-3">
                {o.category && (
                  <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-1">{o.category}</div>
                )}
                <p className="text-[12.5px] text-ink leading-relaxed">{o.observation_text}</p>
                {o.timestamp_ref != null && (
                  <button
                    onClick={() => onJump(o.timestamp_ref!)}
                    className="text-[11px] font-mono text-accent hover:underline mt-1"
                  >
                    @ {o.timestamp_ref.toFixed(0)}s
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
