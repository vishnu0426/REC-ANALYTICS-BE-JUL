import { SentimentAnalysis, EmotionAnalysis } from "@/lib/api";
import Badge, { BadgeTone } from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import SentimentTimelineChart from "@/components/charts/SentimentTimelineChart";
import EmotionTimeline from "@/components/charts/EmotionTimeline";

const SENTIMENT_TONE: Record<string, BadgeTone> = {
  positive: "good",
  neutral: "muted",
  negative: "bad",
};

function SentimentStage({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-faint font-medium mb-1">{label}</div>
      {value ? <Badge tone={SENTIMENT_TONE[value] || "muted"}>{value}</Badge> : <span className="text-muted text-[12.5px]">—</span>}
    </div>
  );
}

export default function SentimentEmotionPanel({
  sentiment,
  emotion,
}: {
  sentiment: SentimentAnalysis | null;
  emotion: EmotionAnalysis | null;
}) {
  if (!sentiment && !emotion) {
    return <EmptyState title="Sentiment & emotion not available" description="This call hasn't finished analysis yet." />;
  }

  return (
    <div className="space-y-6">
      {sentiment && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-medium text-ink">Sentiment</div>
            <Badge tone={SENTIMENT_TONE[sentiment.overall_sentiment] || "muted"}>{sentiment.overall_sentiment} overall</Badge>
          </div>
          <SentimentTimelineChart timeline={sentiment.timeline} />
          <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-hairline">
            <SentimentStage label="Beginning" value={sentiment.beginning_sentiment} />
            <SentimentStage label="Middle" value={sentiment.middle_sentiment} />
            <SentimentStage label="End" value={sentiment.end_sentiment} />
          </div>
        </div>
      )}

      {emotion && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-medium text-ink">Emotion</div>
            <div className="text-[12px] text-muted">
              customer: <span className="text-ink font-medium">{emotion.dominant_customer_emotion || "—"}</span>
              <span className="mx-1.5 text-hairline">·</span>
              agent: <span className="text-ink font-medium">{emotion.dominant_agent_emotion || "—"}</span>
            </div>
          </div>
          <EmotionTimeline timeline={emotion.timeline} />
        </div>
      )}
    </div>
  );
}
