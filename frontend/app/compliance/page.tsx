import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import MetricCard from "@/components/MetricCard";
import EmptyState from "@/components/EmptyState";
import Badge, { BadgeTone } from "@/components/Badge";
import ComplianceRuleChart from "@/components/charts/ComplianceRuleChart";
import ComplianceSeverityChart from "@/components/charts/ComplianceSeverityChart";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, BadgeTone> = {
  low: "muted",
  medium: "warn",
  high: "bad",
  critical: "bad",
};

export default async function CompliancePage() {
  let summary;
  try {
    summary = await api.complianceSummary();
  } catch {
    summary = null;
  }

  return (
    <PageContainer>
      <header className="mb-7">
        <h1 className="font-display text-[20px] font-semibold tracking-tight">Compliance</h1>
        <p className="text-muted text-[13px] mt-1">
          Org-wide violation trends. Per-call violations live on each call's Compliance tab.
        </p>
      </header>

      {!summary ? (
        <div className="border border-hairline rounded-lg px-5 py-4 text-sm text-warn bg-warn/5">
          Can't reach the API yet — start the backend to see live data.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-7">
            <MetricCard label="Processed Calls" value={String(summary.total_processed_calls)} />
            <MetricCard
              label="Clean Call Rate"
              value={summary.clean_call_percent != null ? `${summary.clean_call_percent}%` : "—"}
              accent={summary.clean_call_percent != null && summary.clean_call_percent >= 90 ? "good" : "warn"}
            />
            <MetricCard
              label="Calls With Violations"
              value={String(summary.calls_with_violations)}
              accent={summary.calls_with_violations > 0 ? "bad" : "default"}
            />
          </div>

          {summary.by_rule.length === 0 ? (
            <EmptyState
              variant="good"
              icon={ShieldCheck}
              title="No compliance violations recorded"
              description="Every processed call has come back clean so far."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 mb-7">
              <div className="border border-hairline rounded-lg px-4 py-4">
                <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-3">By Rule</div>
                <ComplianceRuleChart data={summary.by_rule} />
              </div>
              <div className="border border-hairline rounded-lg px-4 py-4">
                <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-3">By Severity</div>
                <ComplianceSeverityChart bySeverity={summary.by_severity} />
              </div>
            </div>
          )}

          {summary.recent_violations.length > 0 && (
            <section>
              <h2 className="font-display text-[14px] font-semibold text-ink mb-3">Recent Violations</h2>
              <div className="border border-hairline rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-hairline bg-panel text-left text-faint text-[11px] uppercase tracking-wider">
                      <th className="px-4 py-2.5 font-medium">Call</th>
                      <th className="px-4 py-2.5 font-medium">Agent</th>
                      <th className="px-4 py-2.5 font-medium">Rule</th>
                      <th className="px-4 py-2.5 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent_violations.map((v) => (
                      <tr key={v.id} className="border-b border-hairline last:border-0 hover:bg-panelRaised/60 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/calls/${v.call_id}`} className="text-ink hover:text-accent font-medium">
                            {v.call_filename}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted">{v.agent_name || "—"}</td>
                        <td className="px-4 py-3 font-mono text-muted">{v.rule_code}</td>
                        <td className="px-4 py-3">
                          <Badge tone={SEVERITY_TONE[v.severity] || "muted"}>{v.severity}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </PageContainer>
  );
}
