"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api, CallSummary, TranscriptSegment, QAEvaluation,
  ComplianceViolation, TimelineEvent, CallAnalytics, CallExtraction,
  CallClassification, CallLabel, PauseEvent, SentimentAnalysis,
  EmotionAnalysis, AIObservation, Recommendation, ProcessingJob,
  CallInsight,
  formatCallName, formatDuration, riskColor,
} from "@/lib/api";
import EvaluationFormsPanel from "@/components/forms/EvaluationFormsPanel";
import ManualQAPanel from "@/components/ManualQAPanel";
import AudioPlayer, { AudioPlayerHandle } from "@/components/AudioPlayer";
import TranscriptView from "@/components/TranscriptView";
import QAScorecard from "@/components/QAScorecard";
import ComplianceList from "@/components/ComplianceList";
import CallOverviewCard from "@/components/CallOverviewCard";
import SentimentEmotionPanel from "@/components/SentimentEmotionPanel";
import InsightsPanel from "@/components/InsightsPanel";
import PauseList from "@/components/PauseList";
import ProcessingTimeline from "@/components/ProcessingTimeline";
import ProcessingFailedPanel from "@/components/ProcessingFailedPanel";
import PageContainer from "@/components/PageContainer";
import { SkeletonText } from "@/components/Skeleton";

type Tab = "transcript" | "qa" | "compliance" | "sentiment" | "analytics" | "insights";

export default function CallDetailClient({ callId }: { callId: string }) {
  const [call, setCall] = useState<CallSummary | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<"playback" | "original" | null>(null);
  const [audioPeaks, setAudioPeaks] = useState<number[] | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioError, setAudioError] = useState(false);
  const audioRetries = useRef(0);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [qa, setQa] = useState<QAEvaluation | null>(null);
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null);
  const [extraction, setExtraction] = useState<CallExtraction | null>(null);
  const [classification, setClassification] = useState<CallClassification | null>(null);
  const [labels, setLabels] = useState<CallLabel[]>([]);
  const [pauses, setPauses] = useState<PauseEvent[]>([]);
  const [sentiment, setSentiment] = useState<SentimentAnalysis | null>(null);
  const [emotion, setEmotion] = useState<EmotionAnalysis | null>(null);
  const [observations, setObservations] = useState<AIObservation[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [insight, setInsight] = useState<CallInsight | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");
  const [qaView, setQaView] = useState<"ai" | "manual" | "forms">("ai");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const playerRef = useRef<AudioPlayerHandle>(null);

  const loadAudio = useCallback(async (): Promise<boolean> => {
    try {
      const audio = await api.getAudioUrl(callId);
      setAudioSource(audio.source ?? "playback");
      setAudioPeaks(audio.peaks ?? null);
      setAudioDuration(audio.duration ?? null);
      setAudioUrl(audio.url);
      setAudioError(false);
      return true;
    } catch {
      return false;
    }
  }, [callId]);

  // Called by the retry button (and by the player when the media fails to
  // load, e.g. an expired presigned URL): re-mints a fresh URL. After two
  // consecutive automatic failures, stop and show the error strip instead
  // of looping.
  const retryAudio = useCallback(async () => {
    setAudioError(false);
    if (!(await loadAudio())) setAudioError(true);
  }, [loadAudio]);

  const handlePlayerError = useCallback(async () => {
    if (audioRetries.current >= 2) {
      setAudioError(true);
      return;
    }
    audioRetries.current += 1;
    if (!(await loadAudio())) setAudioError(true);
  }, [loadAudio]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const c = await api.getCall(callId);
        if (cancelled) return;
        setCall(c);

        // One silent retry for transient failures, then a visible error
        // strip — a swallowed failure here used to silently drop the player.
        if (!(await loadAudio()) && !cancelled && !(await loadAudio()) && !cancelled) {
          setAudioError(true);
        }

        const jobsResult = await api.getJobs(callId).catch(() => []);
        if (!cancelled) setJobs(jobsResult || []);

        if (c.status === "processed") {
          const [t, q, v, ev, an, ext, cls, lbl, pz, sen, emo, obs, rec, ins] = await Promise.all([
            api.getTranscript(callId).catch(() => null),
            api.getQA(callId).catch(() => null),
            api.getCompliance(callId).catch(() => []),
            api.getTimeline(callId).catch(() => []),
            api.getAnalytics(callId).catch(() => null),
            api.getExtraction(callId).catch(() => null),
            api.getClassification(callId).catch(() => null),
            api.getLabels(callId).catch(() => []),
            api.getPauses(callId).catch(() => []),
            api.getSentiment(callId).catch(() => null),
            api.getEmotion(callId).catch(() => null),
            api.getObservations(callId).catch(() => []),
            api.getRecommendations(callId).catch(() => []),
            api.getInsights(callId).catch(() => null),
          ]);
          if (cancelled) return;
          if (t) setSegments(t.segments);
          if (q) setQa(q);
          setViolations(v || []);
          setEvents(ev || []);
          setAnalytics(an);
          setExtraction(ext);
          setClassification(cls);
          setLabels(lbl || []);
          setPauses(pz || []);
          setSentiment(sen);
          setEmotion(emo);
          setObservations(obs || []);
          setRecommendations(rec || []);
          setInsight(ins);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [callId, loadAudio, reloadKey]);

  // Poll while the call is still in flight (fresh upload or after "Retry
  // processing"), then re-run the full load above once it reaches a terminal
  // state so transcript/QA/audio appear in place without a manual refresh.
  const inProgress = !!call && call.status !== "processed" && call.status !== "failed";
  useEffect(() => {
    if (!inProgress) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const c = await api.getCall(callId);
        if (cancelled) return;
        setCall(c);
        if (c.status === "processed" || c.status === "failed") {
          audioRetries.current = 0;
          setReloadKey((n) => n + 1);
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (!cancelled) timer = setTimeout(tick, 3000);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inProgress, callId]);

  const jump = (t: number) => playerRef.current?.seekTo(t);

  if (error) return <PageContainer><div className="text-bad text-sm">{error}</div></PageContainer>;
  if (!call) {
    return (
      <PageContainer>
        <SkeletonText lines={2} className="mb-6 max-w-sm" />
        <div className="h-24 bg-panelRaised rounded-lg animate-pulse mb-6" />
        <SkeletonText lines={6} />
      </PageContainer>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "transcript", label: "Transcript" },
    { key: "qa", label: "QA Scorecard" },
    { key: "compliance", label: "Compliance" },
    { key: "sentiment", label: "Sentiment & Emotion" },
    { key: "analytics", label: "Analytics" },
    { key: "insights", label: "Insights" },
  ];

  return (
    <PageContainer>
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h1
            className="font-display text-[18px] font-semibold tracking-tight"
            title={call.original_filename}
          >
            {formatCallName(call.original_filename)}
          </h1>
          <div className="text-[12.5px] text-muted mt-1 flex gap-3">
            <span>{call.agent_name || "Unassigned agent"}</span>
            <span className="text-hairline">·</span>
            <span className="font-mono tabular">{formatDuration(call.duration_seconds)}</span>
            <span className="text-hairline">·</span>
            <span className="capitalize">{call.status}</span>
          </div>
        </div>
        {call.risk_level && (
          <div className={`text-[12px] font-medium px-2.5 py-1 rounded-sm border border-hairline ${riskColor(call.risk_level)}`}>
            {call.risk_level} risk
          </div>
        )}
      </header>

      {call.status === "failed" ? (
        <ProcessingFailedPanel call={call} onRetried={() =>
          setCall((c) => (c ? { ...c, status: "validating", failure: null, failure_reason: null } : c))
        } />
      ) : call.status !== "processed" ? (
        <div className="border border-hairline rounded-lg px-5 py-8 text-center text-sm">
          <div className="text-muted">
            This recording is still being processed — transcript, QA, and compliance results will appear here shortly.
          </div>
        </div>
      ) : (
        <>
          <CallOverviewCard
            classification={classification}
            labels={labels}
            healthScore={analytics?.conversation?.health_score ?? null}
            extraction={extraction}
          />

          <div className="mb-6">
            {audioError ? (
              <div className="bg-panel border border-hairline rounded-lg px-5 py-4 flex items-center justify-between gap-4">
                <div className="text-[13px] text-muted">
                  Audio playback couldn&apos;t be loaded — the link may have expired or storage is unreachable.
                </div>
                <button
                  onClick={retryAudio}
                  className="shrink-0 text-[12.5px] font-medium px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90"
                >
                  Reload audio
                </button>
              </div>
            ) : audioUrl ? (
              <>
                <AudioPlayer
                  ref={playerRef}
                  audioUrl={audioUrl}
                  duration={audioDuration ?? call.duration_seconds ?? 0}
                  events={events}
                  peaks={audioPeaks}
                  onError={handlePlayerError}
                />
                {audioSource === "original" && (
                  <div className="text-[11.5px] text-faint mt-1.5">
                    Playing the original upload — a browser-optimized copy isn&apos;t ready yet, so some formats may
                    not play.
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div className="flex gap-1 border-b border-hairline mb-5 overflow-x-auto">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3.5 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  tab === key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
                {key === "compliance" && violations.length > 0 && (
                  <span className="ml-1.5 text-bad">({violations.length})</span>
                )}
              </button>
            ))}
          </div>

          {tab === "transcript" && <TranscriptView segments={segments} onJump={jump} />}
          {tab === "qa" && (
            <div>
              <div className="inline-flex rounded-md border border-hairline overflow-hidden mb-5">
                {([["ai", "AI Evaluation"], ["manual", "Manual Review"], ["forms", "Evaluation Forms"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setQaView(key)}
                    className={`px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                      qaView === key ? "bg-panelRaised text-ink" : "bg-panel text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {qaView === "ai" ? (
                qa ? (
                  <QAScorecard qa={qa} onJump={jump} />
                ) : (
                  <div className="text-[12.5px] text-muted">AI QA evaluation is not available for this call.</div>
                )
              ) : qaView === "manual" ? (
                <ManualQAPanel callId={callId} qa={qa} />
              ) : (
                <EvaluationFormsPanel callId={callId} />
              )}
            </div>
          )}
          {tab === "compliance" && <ComplianceList violations={violations} onJump={jump} />}
          {tab === "sentiment" && <SentimentEmotionPanel sentiment={sentiment} emotion={emotion} />}
          {tab === "insights" && (
            <InsightsPanel insight={insight} observations={observations} recommendations={recommendations} onJump={jump} />
          )}
          {tab === "analytics" && analytics && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-hairline rounded-lg px-4 py-4">
                  <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-3">Conversation</div>
                  <dl className="space-y-2 text-[12.5px]">
                    {analytics.conversation && Object.entries(analytics.conversation).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-muted capitalize">{k.replace(/_/g, " ")}</dt>
                        <dd className="font-mono tabular">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="border border-hairline rounded-lg px-4 py-4">
                  <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-3">Customer</div>
                  <dl className="space-y-2 text-[12.5px]">
                    {analytics.customer && Object.entries(analytics.customer).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-muted capitalize">{k.replace(/_/g, " ")}</dt>
                        <dd className="font-mono tabular">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              <div className="border border-hairline rounded-lg px-4 py-4">
                <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-3">Pauses</div>
                <PauseList pauses={pauses} onJump={jump} />
              </div>
              <div className="border border-hairline rounded-lg px-4 py-4">
                <div className="text-[11px] uppercase tracking-wide text-faint font-medium mb-3">Processing Time</div>
                <ProcessingTimeline jobs={jobs} />
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
