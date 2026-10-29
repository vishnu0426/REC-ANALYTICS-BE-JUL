import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import MetricCard from "@/components/MetricCard";
import CallsTable from "@/components/CallsTable";
import AgentTrendChart from "@/components/charts/AgentTrendChart";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let agent;
  try {
    agent = await api.getAgent(id);
  } catch {
    agent = null;
  }

  if (!agent) {
    return (
      <PageContainer>
        <div className="text-muted text-sm">Agent not found.</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link href="/agents" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Agents
      </Link>

      <header className="mb-7">
        <h1 className="font-display text-[20px] font-semibold tracking-tight">{agent.name}</h1>
        <p className="text-muted text-[13px] mt-1">{agent.team || "No team assigned"}</p>
      </header>

      <div className="flex flex-wrap gap-3 mb-7">
        <MetricCard label="Calls" value={String(agent.call_count)} />
        <MetricCard
          label="Avg QA Score"
          value={agent.avg_qa_score != null ? agent.avg_qa_score.toFixed(0) : "—"}
          accent={agent.avg_qa_score != null && agent.avg_qa_score >= 80 ? "good" : "warn"}
        />
        <MetricCard
          label="Avg Health Score"
          value={agent.avg_health_score != null ? agent.avg_health_score.toFixed(0) : "—"}
          accent={agent.avg_health_score != null && agent.avg_health_score >= 80 ? "good" : "warn"}
        />
        <MetricCard
          label="Violations"
          value={String(agent.violation_count)}
          accent={agent.violation_count > 0 ? "bad" : "default"}
        />
        <MetricCard
          label="High Risk Calls"
          value={String(agent.high_risk_call_count)}
          accent={agent.high_risk_call_count > 0 ? "bad" : "default"}
        />
      </div>

      {agent.recent_calls.length >= 2 && (
        <div className="border border-hairline rounded-lg px-4 py-4 mb-7">
          <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-3">QA Score Trend</div>
          <AgentTrendChart calls={agent.recent_calls} />
        </div>
      )}

      <section>
        <h2 className="font-display text-[14px] font-semibold text-ink mb-3">Recent Calls</h2>
        <CallsTable calls={agent.recent_calls} />
      </section>
    </PageContainer>
  );
}
