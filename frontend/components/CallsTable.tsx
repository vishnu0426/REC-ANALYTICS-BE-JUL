import Link from "next/link";
import { CheckCircle2, PhoneOff } from "lucide-react";
import { CallSummary, formatCallName, formatDate, formatDuration, riskColor, scoreColor } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Badge, { BadgeTone } from "@/components/Badge";

const STATUS_TONE: Record<string, BadgeTone> = {
  uploaded: "muted",
  validating: "warn",
  processing: "accent",
  processed: "good",
  failed: "bad",
};

export default function CallsTable({ calls }: { calls: CallSummary[] }) {
  if (calls.length === 0) {
    return (
      <EmptyState
        icon={PhoneOff}
        title="No calls yet"
        description="Upload a recording to see it processed here."
      />
    );
  }

  return (
    <div className="border border-hairline rounded-lg overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-hairline bg-panel text-left text-faint text-[11px] uppercase tracking-wider">
            <th className="px-4 py-2.5 font-medium">Call</th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Agent</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Duration</th>
            <th className="px-4 py-2.5 font-medium">Processing Time</th>
            <th className="px-4 py-2.5 font-medium">QA</th>
            <th className="px-4 py-2.5 font-medium">Violations</th>
            <th className="px-4 py-2.5 font-medium">Risk</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className="border-b border-hairline last:border-0 hover:bg-panel/70 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/calls/${call.id}`}
                  title={call.original_filename}
                  className="text-ink hover:text-accent font-medium"
                >
                  {formatCallName(call.original_filename)}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted whitespace-nowrap">{formatDate(call.call_date)}</td>
              <td className="px-4 py-3 text-muted">{call.agent_name || "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[call.status] || "muted"} dot={call.status === "processing"}>
                  {call.status}
                </Badge>
                {call.status === "failed" && call.failure && (
                  <div className="text-[11.5px] text-muted mt-1 max-w-[220px] truncate" title={call.failure.message}>
                    {call.failure.title}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-muted tabular">{formatDuration(call.duration_seconds)}</td>
              <td className="px-4 py-3 font-mono text-muted tabular">
                {call.processing_duration_seconds != null ? `${call.processing_duration_seconds.toFixed(1)}s` : "—"}
              </td>
              <td className={`px-4 py-3 font-mono tabular font-medium ${scoreColor(call.overall_qa_score)}`}>
                <span className="inline-flex items-center gap-1.5">
                  {call.overall_qa_score != null ? call.overall_qa_score.toFixed(0) : "—"}
                  {call.manual_reviewed && (
                    <CheckCircle2
                      className="w-3.5 h-3.5 text-good"
                      aria-label={`Manually reviewed${call.manual_qa_score != null ? ` — human score ${call.manual_qa_score.toFixed(0)}` : ""}`}
                    />
                  )}
                </span>
              </td>
              <td className="px-4 py-3 font-mono tabular">
                {call.compliance_violation_count > 0 ? (
                  <span className="text-bad">{call.compliance_violation_count}</span>
                ) : (
                  <span className="text-faint">0</span>
                )}
              </td>
              <td className={`px-4 py-3 font-medium ${riskColor(call.risk_level)}`}>
                {call.risk_level || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
