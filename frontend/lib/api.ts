const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export interface CallSummary {
  id: string;
  status: "uploaded" | "validating" | "processing" | "processed" | "failed";
  agent_name: string | null;
  duration_seconds: number | null;
  call_date: string | null;
  overall_qa_score: number | null;
  compliance_violation_count: number;
  risk_level: "low" | "medium" | "high" | null;
  original_filename: string;
  category?: string | null;
  health_score?: number | null;
  labels?: LabelName[];
  failure_reason?: string | null;
  failure?: {
    code: string;
    title: string;
    message: string;
    action: string;
    retryable: boolean;
  } | null;
  processing_duration_seconds?: number | null;
  manual_reviewed?: boolean;
  manual_qa_score?: number | null;
}

export interface DashboardSummary {
  total_calls: number;
  processed: number;
  processing: number;
  failed: number;
  average_qa: number | null;
  compliance_percent: number | null;
  high_risk_calls: number;
  recent_calls: CallSummary[];
}

export interface TranscriptSegment {
  sequence: number;
  speaker_role: string;
  start_time: number;
  end_time: number;
  text: string;
  stt_confidence: number;
}

export interface QACriterion {
  criterion: string;
  score: number;
  explanation: string | null;
  timestamp_ref: number | null;
  transcript_evidence: string | null;
  confidence: number;
}

export interface QAEvaluation {
  overall_score: number;
  strengths: string | null;
  weaknesses: string | null;
  coaching_suggestions: string | null;
  improvement_plan: string | null;
  criteria: QACriterion[];
}

export interface ComplianceViolation {
  id: string;
  rule_code: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp_ref: number | null;
  explanation: string | null;
  evidence: string | null;
  reviewed: boolean;
  review_outcome: string | null;
}

export interface TimelineEvent {
  event_type: string;
  start_time: number;
  end_time: number | null;
  description: string | null;
}

export interface ConversationAnalytics {
  duration_seconds: number | null;
  avg_silence_seconds: number | null;
  longest_silence_seconds: number | null;
  talk_ratio_agent: number | null;
  talk_ratio_customer: number | null;
  interruption_count: number;
  questions_asked: number;
  questions_answered: number;
  hold_count: number;
  hold_duration_seconds: number;
  audio_quality_score: number | null;
  health_score: number | null;
}

export interface CustomerAnalytics {
  intent: string | null;
  mood: string | null;
  risk_level: "low" | "medium" | "high" | null;
  repeat_call_probability: number | null;
  escalation_risk: number | null;
  churn_risk: number | null;
  csat_prediction: number | null;
}

export interface CallAnalytics {
  conversation: ConversationAnalytics | null;
  customer: CustomerAnalytics | null;
}

export interface SentimentTimelinePoint {
  timestamp: number;
  score: number;
  label: string;
}

export interface SentimentAnalysis {
  overall_sentiment: string;
  beginning_sentiment: string | null;
  middle_sentiment: string | null;
  end_sentiment: string | null;
  timeline: SentimentTimelinePoint[];
}

export interface EmotionTimelinePoint {
  timestamp: number;
  emotion: string;
  confidence: number;
}

export interface EmotionAnalysis {
  dominant_customer_emotion: string | null;
  dominant_agent_emotion: string | null;
  timeline: EmotionTimelinePoint[];
}

export interface CallExtraction {
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_account_id: string | null;
  call_reason_primary: string | null;
  call_reason_secondary: string | null;
  resolution_summary: string | null;
  follow_up_required: boolean;
  follow_up_reason: string | null;
}

export interface CallClassification {
  category: string | null;
  subcategory: string | null;
  complexity: "low" | "medium" | "high" | null;
  confidence: number;
}

export type LabelName =
  | "urgent"
  | "escalation_required"
  | "follow_up_needed"
  | "satisfaction_survey"
  | "training_opportunity"
  | "upsell_opportunity";

export interface CallLabel {
  label: LabelName;
  confidence: number;
  reason: string | null;
}

export interface PauseEvent {
  start_time: number;
  end_time: number;
  duration_seconds: number;
  severity: "notable" | "excessive";
  preceding_speaker: string | null;
  following_speaker: string | null;
}

export interface AIObservation {
  observation_text: string;
  timestamp_ref: number | null;
  category: string | null;
}

export interface Recommendation {
  category: string;
  text: string;
  priority: "low" | "medium" | "high";
}

export interface AgentSummary {
  id: string;
  name: string;
  team: string | null;
  external_agent_id: string | null;
  call_count: number;
  avg_qa_score: number | null;
  avg_health_score: number | null;
  violation_count: number;
  high_risk_call_count: number;
}

export interface AgentDetail extends AgentSummary {
  recent_calls: CallSummary[];
}

export interface ComplianceRuleBreakdown {
  rule_code: string;
  category: string;
  count: number;
}

export interface ComplianceViolationWithCall extends ComplianceViolation {
  call_id: string;
  call_filename: string;
  agent_name: string | null;
}

export interface ComplianceSummary {
  total_processed_calls: number;
  calls_with_violations: number;
  clean_call_percent: number | null;
  by_rule: ComplianceRuleBreakdown[];
  by_severity: Record<string, number>;
  recent_violations: ComplianceViolationWithCall[];
}

export interface CallInsight {
  main_topic: string | null;
  intent: string | null;
  outcome: string | null;
  root_cause: string | null;
  executive_summary: string | null;
  detailed_summary: string | null;
  sub_topics: string[];
  keywords: string[];
  key_discussion_points: string[];
  action_items: { description: string; owner: string }[];
}

export interface ManualQACriterion {
  criterion: string;
  ai_score: number | null;
  manual_score: number | null; // null = reviewer marked N/A
  comment: string | null;
}

export interface ManualQAReview {
  reviewer_name: string;
  status: "draft" | "completed";
  overall_score: number | null;
  notes: string | null;
  updated_at?: string | null;
  criteria: ManualQACriterion[];
}

export interface HeatmapCell {
  row: string;
  col: string;
  value: number | null;
  n: number;
}

export interface CategoryStat {
  category: string;
  count: number;
  avg_sentiment: number | null;
  avg_qa: number | null;
}

export interface KeywordStat {
  keyword: string;
  count: number;
  avg_sentiment: number | null;
}

export interface SentimentTrendDay {
  day: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface CriterionDelta {
  criterion: string;
  avg_delta: number;
  n: number;
}

export interface QACalibration {
  reviewed_calls: number;
  mean_abs_delta: number | null;
  agreement_percent: number | null;
  by_criterion: CriterionDelta[];
}

export interface AnalyticsOverview {
  kpis: {
    processed_calls: number;
    avg_qa_score: number | null;
    avg_health_score: number | null;
    negative_end_percent: number | null;
    avg_duration_seconds: number | null;
    follow_up_required: number;
    needs_attention: number;
  };
  volume_heatmap: HeatmapCell[];
  agent_criteria_heatmap: HeatmapCell[];
  category_stats: CategoryStat[];
  keywords: KeywordStat[];
  sentiment_trend: SentimentTrendDay[];
  emotion_distribution: Record<string, number>;
  qa_calibration: QACalibration;
}

export interface ProcessingJob {
  stage: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

export interface CallListResponse {
  items: CallSummary[];
  total: number;
  page: number;
  page_size: number;
}

export const api = {
  dashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
  listCalls: (params?: { status?: string; riskLevel?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.riskLevel) q.set("risk_level", params.riskLevel);
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("page_size", String(params.pageSize));
    const qs = q.toString();
    return request<CallListResponse>(`/calls${qs ? `?${qs}` : ""}`);
  },
  getCall: (id: string) => request<CallSummary>(`/calls/${id}`),
  reprocessCall: (id: string) =>
    request<{ call_id: string; status: string }>(`/calls/${id}/reprocess`, { method: "POST" }),
  getAudioUrl: (id: string) =>
    request<{
      url: string;
      expires_minutes: number;
      source: "playback" | "original";
      peaks: number[] | null;
      duration: number | null;
    }>(`/calls/${id}/audio`),
  getTranscript: (id: string) => request<{ call_id: string; pii_masked: boolean; segments: TranscriptSegment[] }>(`/calls/${id}/transcript`),
  getQA: (id: string) => request<QAEvaluation>(`/calls/${id}/qa`),
  getCompliance: (id: string) => request<ComplianceViolation[]>(`/calls/${id}/compliance`),
  getSentiment: (id: string) => request<SentimentAnalysis>(`/calls/${id}/sentiment`),
  getTimeline: (id: string) => request<TimelineEvent[]>(`/calls/${id}/timeline`),
  getAnalytics: (id: string) => request<CallAnalytics>(`/calls/${id}/analytics`),
  getExtraction: (id: string) => request<CallExtraction>(`/calls/${id}/extraction`),
  getClassification: (id: string) => request<CallClassification>(`/calls/${id}/classification`),
  getLabels: (id: string) => request<CallLabel[]>(`/calls/${id}/labels`),
  getPauses: (id: string) => request<PauseEvent[]>(`/calls/${id}/pauses`),
  getEmotion: (id: string) => request<EmotionAnalysis>(`/calls/${id}/emotion`),
  getObservations: (id: string) => request<AIObservation[]>(`/calls/${id}/observations`),
  getInsights: (id: string) => request<CallInsight>(`/calls/${id}/insights`),
  getManualQA: (id: string) => request<ManualQAReview>(`/calls/${id}/manual-qa`),
  saveManualQA: (id: string, review: Omit<ManualQAReview, "overall_score" | "updated_at">) =>
    request<ManualQAReview>(`/calls/${id}/manual-qa`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
    }),
  analyticsOverview: () => request<AnalyticsOverview>(`/analytics/overview`),
  getRecommendations: (id: string) => request<Recommendation[]>(`/calls/${id}/recommendations`),
  listAgents: () => request<AgentSummary[]>(`/agents`),
  getAgent: (id: string) => request<AgentDetail>(`/agents/${id}`),
  complianceSummary: () => request<ComplianceSummary>(`/compliance/summary`),
  getJobs: (id: string) => request<ProcessingJob[]>(`/calls/${id}/jobs`),
  uploadCall: async (file: File, agentName?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (agentName) form.append("agent_name", agentName);
    const res = await fetch(`${API_BASE}/calls`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json() as Promise<{ call_id: string; status: string }>;
  },
};

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Calls ingested from call-records/ (PBX/FreeSWITCH drops, see
 * call_ingest.py) keep the raw external UUID + millisecond timestamps in
 * `original_filename`, e.g.
 * "a507fa8b-3dc9-4366-9580-da1b325b85ab-1784543284561-call_1005_1001_agnoshin.com_1784542998721.wav" --
 * meaningless to a human reader, and not needed here since the Call's own
 * `id` already carries identity. Strips a leading UUID, a leading or
 * trailing bare timestamp segment, leaving the human-relevant part (e.g.
 * "call_1005_1001_agnoshin.com.wav"). Falls back to the original filename
 * untouched for anything that doesn't match this convention (e.g. a normal
 * file a user uploaded through the dashboard).
 */
export function formatCallName(filename: string): string {
  let name = filename;
  name = name.replace(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/, "");
  name = name.replace(/^\d{10,13}-/, "");
  name = name.replace(/_\d{10,13}(\.[a-zA-Z0-9]+)$/, "$1");
  return name || filename;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function riskColor(risk: string | null): string {
  switch (risk) {
    case "high": return "text-bad";
    case "medium": return "text-warn";
    case "low": return "text-good";
    default: return "text-muted";
  }
}

export function scoreColor(score: number | null): string {
  if (score == null) return "text-muted";
  if (score >= 85) return "text-good";
  if (score >= 65) return "text-warn";
  return "text-bad";
}
