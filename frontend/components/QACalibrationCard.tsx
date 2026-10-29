import { QACalibration } from "@/lib/api";

/**
 * AI vs human QA calibration. Per-criterion bars diverge from a center
 * baseline: bars left (red) mean human reviewers score that criterion lower
 * than the AI (AI over-rates it); bars right (green) mean the AI under-rates
 * it. Values are printed beside every bar, so color is never the only channel.
 */

const DELTA_RANGE = 25; // clamp display at ±25 points

export default function QACalibrationCard({ calibration }: { calibration: QACalibration }) {
  if (calibration.reviewed_calls === 0) {
    return (
      <div className="text-[12.5px] text-muted py-6 text-center">
        No completed manual reviews yet — complete a Manual QA review on any call to start measuring how well AI
        scoring matches your reviewers.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-6 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-0.5">Reviewed calls</div>
          <div className="font-mono text-[20px] font-medium tabular text-ink">{calibration.reviewed_calls}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-0.5">Agreement (±10 pts)</div>
          <div className="font-mono text-[20px] font-medium tabular text-ink">
            {calibration.agreement_percent != null ? `${calibration.agreement_percent}%` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-0.5">Mean |AI − human|</div>
          <div className="font-mono text-[20px] font-medium tabular text-ink">
            {calibration.mean_abs_delta != null ? `${calibration.mean_abs_delta} pts` : "—"}
          </div>
        </div>
      </div>

      {calibration.by_criterion.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10.5px] text-faint mb-1">
            <span>human scores lower (AI over-rates)</span>
            <span>human scores higher</span>
          </div>
          {calibration.by_criterion.map((c) => {
            const clamped = Math.max(-DELTA_RANGE, Math.min(DELTA_RANGE, c.avg_delta));
            const widthPct = (Math.abs(clamped) / DELTA_RANGE) * 50;
            const negative = clamped < 0;
            return (
              <div key={c.criterion} className="flex items-center gap-3">
                <div className="w-36 text-right text-[11.5px] text-muted capitalize shrink-0">
                  {c.criterion.replace(/_/g, " ")}
                </div>
                <div className="relative flex-1 h-4">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-hairline" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2.5"
                    style={{
                      width: `${widthPct}%`,
                      background: negative ? "#C1352E" : "#12805A",
                      left: negative ? `${50 - widthPct}%` : "50%",
                      borderRadius: negative ? "4px 0 0 4px" : "0 4px 4px 0",
                    }}
                  />
                </div>
                <div className="w-20 font-mono text-[11.5px] tabular text-muted shrink-0">
                  {c.avg_delta > 0 ? "+" : ""}
                  {c.avg_delta} <span className="text-faint">({c.n})</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
