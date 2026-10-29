import { AlertTriangle } from "lucide-react";
import { ComplianceViolation } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Badge, { BadgeTone } from "@/components/Badge";

const SEVERITY_TONE: Record<string, BadgeTone> = {
  low: "muted",
  medium: "warn",
  high: "bad",
  critical: "bad",
};

export default function ComplianceList({ violations, onJump }: { violations: ComplianceViolation[]; onJump: (t: number) => void }) {
  if (violations.length === 0) {
    return (
      <EmptyState
        variant="good"
        icon={AlertTriangle}
        title="No compliance violations detected"
        description="This call was checked against every active compliance rule and came back clean."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {violations.map((v) => (
        <div key={v.id} className="border border-hairline rounded-md px-3.5 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-mono text-muted">{v.rule_code}</span>
            <Badge tone={SEVERITY_TONE[v.severity] || "muted"}>{v.severity}</Badge>
          </div>
          {v.explanation && <p className="text-[12.5px] text-ink leading-relaxed mb-1.5">{v.explanation}</p>}
          {v.evidence && (
            <button
              onClick={() => v.timestamp_ref != null && onJump(v.timestamp_ref)}
              className="text-left text-[12px] font-mono text-accent hover:underline block"
            >
              "{v.evidence}"
              {v.timestamp_ref != null && <span className="text-faint ml-1.5">@ {v.timestamp_ref.toFixed(0)}s</span>}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
