import { BarChart3 } from "lucide-react";
import { api, formatDuration } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import MetricCard from "@/components/MetricCard";
import EmptyState from "@/components/EmptyState";
import Heatmap from "@/components/charts/Heatmap";
import CategoryTreemap from "@/components/charts/CategoryTreemap";
import TagCloud from "@/components/TagCloud";
import SentimentTrendChart from "@/components/charts/SentimentTrendChart";
import EmotionDistributionChart from "@/components/charts/EmotionDistributionChart";
import QACalibrationCard from "@/components/QACalibrationCard";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h));
const QA_CRITERIA = [
  "greeting", "identity_verification", "listening", "empathy",
  "communication", "professionalism", "knowledge", "resolution", "closing",
];

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel border border-hairline rounded-lg px-5 py-4">
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-faint font-medium">{title}</div>
        {subtitle && <div className="text-[12px] text-muted mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export default async function AnalyticsPage() {
  let overview;
  try {
    overview = await api.analyticsOverview();
  } catch {
    overview = null;
  }

  return (
    <PageContainer>
      <header className="mb-7">
        <h1 className="font-display text-[20px] font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted text-[13px] mt-1">
          Org-wide patterns across every processed call — volume, quality, topics, and how AI scoring compares to
          your reviewers.
        </p>
      </header>

      {!overview ? (
        <div className="border border-hairline rounded-lg px-5 py-4 text-sm text-warn bg-warn/5">
          Can&apos;t reach the API yet — start the backend to see live data.
        </div>
      ) : overview.kpis.processed_calls === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No processed calls yet"
          description="Upload recordings and analytics will build up here as they finish processing."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-7">
            <MetricCard label="Processed Calls" value={String(overview.kpis.processed_calls)} />
            <MetricCard
              label="Avg AI QA"
              value={overview.kpis.avg_qa_score != null ? String(overview.kpis.avg_qa_score) : "—"}
              accent={overview.kpis.avg_qa_score != null && overview.kpis.avg_qa_score >= 85 ? "good" : "default"}
            />
            <MetricCard
              label="Avg Health"
              value={overview.kpis.avg_health_score != null ? String(overview.kpis.avg_health_score) : "—"}
            />
            <MetricCard
              label="Negative Endings"
              value={overview.kpis.negative_end_percent != null ? `${overview.kpis.negative_end_percent}%` : "—"}
              accent={
                overview.kpis.negative_end_percent != null && overview.kpis.negative_end_percent > 20
                  ? "bad"
                  : "default"
              }
              sublabel="calls ending on negative sentiment"
            />
            <MetricCard
              label="Avg Duration"
              value={formatDuration(overview.kpis.avg_duration_seconds)}
            />
            <MetricCard
              label="Follow-ups"
              value={String(overview.kpis.follow_up_required)}
              accent={overview.kpis.follow_up_required > 0 ? "warn" : "default"}
            />
            <MetricCard
              label="Needs Attention"
              value={String(overview.kpis.needs_attention)}
              accent={overview.kpis.needs_attention > 0 ? "bad" : "good"}
              sublabel="escalated / unresolved / callbacks"
            />
          </div>

          <div className="space-y-4">
            {/* Discover Trends — categories treemap + terms cloud, side by side */}
            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <Card title="Categories" subtitle="Size: call volume · Color: how customers leave the call">
                  <CategoryTreemap stats={overview.category_stats} />
                </Card>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-panel border border-hairline rounded-lg px-5 py-4 h-full flex flex-col">
                  <div className="mb-1">
                    <div className="text-[11px] uppercase tracking-wide text-faint font-medium">Terms &amp; Phrases</div>
                    <div className="text-[12px] text-muted mt-0.5">What customers call about</div>
                  </div>
                  <div className="flex-1 min-h-0 max-h-[340px] overflow-hidden">
                    <TagCloud keywords={overview.keywords.slice(0, 28)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card title="Agent × QA Criteria" subtitle="Average AI score per criterion — coaching targets in red">
                <Heatmap
                  cells={overview.agent_criteria_heatmap}
                  cols={QA_CRITERIA.filter((c) =>
                    overview.agent_criteria_heatmap.some((cell) => cell.col === c)
                  )}
                  scale="diverging"
                  midpoint={70}
                  max={100}
                  showValues
                />
              </Card>
              <Card title="Call Volume" subtitle="When calls come in — weekday × hour">
                <Heatmap
                  cells={overview.volume_heatmap}
                  rows={WEEKDAYS}
                  cols={HOURS}
                  scale="sequential"
                  colTickEvery={3}
                />
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card title="Sentiment Trend" subtitle="Overall call sentiment per day, last 30 days">
                <SentimentTrendChart trend={overview.sentiment_trend} />
              </Card>
              <Card title="Customer Emotions" subtitle="Dominant customer emotion per call">
                <EmotionDistributionChart distribution={overview.emotion_distribution} />
              </Card>
            </div>

            <Card title="QA Calibration" subtitle="How AI scoring compares to human reviewers">
              <QACalibrationCard calibration={overview.qa_calibration} />
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
