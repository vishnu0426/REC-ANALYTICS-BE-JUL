import { api } from "@/lib/api";
import MetricCard from "@/components/MetricCard";
import CallsTable from "@/components/CallsTable";
import UploadDropzone from "@/components/UploadDropzone";
import PageContainer from "@/components/PageContainer";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let summary;
  try {
    summary = await api.dashboardSummary();
  } catch {
    summary = null;
  }

  return (
    <PageContainer>
      <header className="mb-7">
        <h1 className="font-display text-[20px] font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted text-[13px] mt-1">
          Every uploaded recording, from storage to investigation report.
        </p>
      </header>

      {!summary ? (
        <div className="border border-hairline rounded-lg px-5 py-4 text-sm text-warn bg-warn/5 mb-7">
          Can't reach the API yet — start the backend (`docker compose up`) to see live data.
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 mb-7">
          <MetricCard label="Total Calls" value={String(summary.total_calls)} />
          <MetricCard label="Processed" value={String(summary.processed)} accent="good" />
          <MetricCard label="Processing" value={String(summary.processing)} accent="default" />
          <MetricCard label="Failed" value={String(summary.failed)} accent={summary.failed > 0 ? "bad" : "default"} />
          <MetricCard
            label="Avg QA Score"
            value={summary.average_qa != null ? summary.average_qa.toFixed(0) : "—"}
            accent={summary.average_qa != null && summary.average_qa >= 80 ? "good" : "warn"}
          />
          <MetricCard
            label="Compliance"
            value={summary.compliance_percent != null ? `${summary.compliance_percent}%` : "—"}
          />
          <MetricCard
            label="High Risk"
            value={String(summary.high_risk_calls)}
            accent={summary.high_risk_calls > 0 ? "bad" : "default"}
          />
        </div>
      )}

      <AutoRefresh
        active={
          !!summary &&
          (summary.processing > 0 ||
            summary.recent_calls.some((c) => ["uploaded", "validating", "processing"].includes(c.status)))
        }
      />

      <div className="mb-7">
        <UploadDropzone />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[14px] font-semibold text-ink">Recent Calls</h2>
        </div>
        <CallsTable calls={summary?.recent_calls || []} />
      </section>
    </PageContainer>
  );
}
