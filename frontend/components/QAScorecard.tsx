import { QAEvaluation } from "@/lib/api";

function barColor(score: number) {
  if (score >= 85) return "#12805A";
  if (score >= 65) return "#9C6510";
  return "#C1352E";
}

export default function QAScorecard({ qa, onJump }: { qa: QAEvaluation; onJump: (t: number) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <div className="font-mono text-[32px] font-semibold tabular" style={{ color: barColor(qa.overall_score) }}>
          {qa.overall_score.toFixed(0)}
        </div>
        <div className="text-muted text-[12px]">overall QA score</div>
      </div>

      <div className="space-y-2.5">
        {qa.criteria.map((c) => (
          <div key={c.criterion} className="border border-hairline rounded-md px-3.5 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[13px] font-medium capitalize">{c.criterion.replace(/_/g, " ")}</div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-faint font-mono">conf {(c.confidence * 100).toFixed(0)}%</span>
                <span className="font-mono text-[14px] tabular font-medium" style={{ color: barColor(c.score) }}>
                  {c.score.toFixed(0)}
                </span>
              </div>
            </div>
            <div className="h-1 bg-hairline rounded-full mb-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: barColor(c.score) }} />
            </div>
            {c.explanation && <p className="text-[12.5px] text-muted leading-relaxed mb-1.5">{c.explanation}</p>}
            {c.transcript_evidence && (
              <button
                onClick={() => c.timestamp_ref != null && onJump(c.timestamp_ref)}
                className="text-left text-[12px] font-mono text-accent hover:underline block"
              >
                "{c.transcript_evidence}"
                {c.timestamp_ref != null && <span className="text-faint ml-1.5">@ {c.timestamp_ref.toFixed(0)}s</span>}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {qa.strengths && (
          <div className="border border-hairline rounded-md px-3.5 py-3">
            <div className="text-[11px] uppercase tracking-wide text-good font-medium mb-1.5">Strengths</div>
            <p className="text-[12.5px] text-muted leading-relaxed">{qa.strengths}</p>
          </div>
        )}
        {qa.weaknesses && (
          <div className="border border-hairline rounded-md px-3.5 py-3">
            <div className="text-[11px] uppercase tracking-wide text-warn font-medium mb-1.5">Weaknesses</div>
            <p className="text-[12.5px] text-muted leading-relaxed">{qa.weaknesses}</p>
          </div>
        )}
      </div>
      {qa.coaching_suggestions && (
        <div className="border border-hairline rounded-md px-3.5 py-3">
          <div className="text-[11px] uppercase tracking-wide text-accent font-medium mb-1.5">Coaching Suggestions</div>
          <p className="text-[12.5px] text-muted leading-relaxed">{qa.coaching_suggestions}</p>
        </div>
      )}
      {qa.improvement_plan && (
        <div className="border border-hairline rounded-md px-3.5 py-3">
          <div className="text-[11px] uppercase tracking-wide text-muted font-medium mb-1.5">Improvement Plan</div>
          <p className="text-[12.5px] text-muted leading-relaxed">{qa.improvement_plan}</p>
        </div>
      )}
    </div>
  );
}
