import { CallClassification, CallLabel, CallExtraction, scoreColor } from "@/lib/api";
import Badge, { BadgeTone } from "@/components/Badge";

const LABEL_TONE: Record<string, BadgeTone> = {
  urgent: "bad",
  escalation_required: "bad",
  follow_up_needed: "warn",
  satisfaction_survey: "accent",
  training_opportunity: "accent",
  upsell_opportunity: "good",
};

const COMPLEXITY_TONE: Record<string, BadgeTone> = {
  low: "good",
  medium: "warn",
  high: "bad",
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-faint font-medium mb-0.5">{label}</div>
      <div className="text-[13px] text-ink">{value || "—"}</div>
    </div>
  );
}

export default function CallOverviewCard({
  classification,
  labels,
  healthScore,
  extraction,
}: {
  classification: CallClassification | null;
  labels: CallLabel[];
  healthScore: number | null;
  extraction: CallExtraction | null;
}) {
  return (
    <div className="bg-panel border border-hairline rounded-lg px-5 py-4 mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className={`font-mono text-[22px] font-semibold tabular ${scoreColor(healthScore ?? null)}`}>
            {healthScore != null ? healthScore.toFixed(0) : "—"}
          </span>
          <span className="text-[11px] text-faint">health score</span>
        </div>
        <div className="w-px h-5 bg-hairline" />
        {classification?.category && <Badge tone="accent">{classification.category.replace(/_/g, " ")}</Badge>}
        {classification?.complexity && (
          <Badge tone={COMPLEXITY_TONE[classification.complexity] || "muted"}>{classification.complexity} complexity</Badge>
        )}
        {[...new Map(labels.map((l) => [l.label, l])).values()].map((l) => (
          <Badge key={l.label} tone={LABEL_TONE[l.label] || "muted"}>
            {l.label.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>

      {extraction && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-hairline">
          <Field label="Customer" value={extraction.customer_name} />
          <Field label="Phone" value={extraction.customer_phone} />
          <Field label="Email" value={extraction.customer_email} />
          <Field label="Account ID" value={extraction.customer_account_id} />
        </div>
      )}

      {extraction && (extraction.call_reason_primary || extraction.resolution_summary) && (
        <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-hairline">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-faint font-medium mb-0.5">Call Reason</div>
            <div className="text-[13px] text-ink">
              {extraction.call_reason_primary || "—"}
              {extraction.call_reason_secondary && <span className="text-muted"> · {extraction.call_reason_secondary}</span>}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-faint font-medium mb-0.5">Resolution</div>
            <div className="text-[13px] text-ink">{extraction.resolution_summary || "—"}</div>
          </div>
        </div>
      )}

      {extraction?.follow_up_required && (
        <div className="pt-3 border-t border-hairline">
          <Badge tone="warn">Follow-up required</Badge>
          {extraction.follow_up_reason && <span className="text-[12.5px] text-muted ml-2">{extraction.follow_up_reason}</span>}
        </div>
      )}
    </div>
  );
}
