"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, ManualQAReview, QAEvaluation } from "@/lib/api";
import Badge from "@/components/Badge";

function scoreHex(score: number) {
  if (score >= 85) return "#12805A";
  if (score >= 65) return "#9C6510";
  return "#C1352E";
}

// manual_score null = reviewer marked the criterion N/A (e.g. a call cut
// short before "closing" ever happened) — excluded from the overall score,
// the same rule the AI pipeline applies.
type RowState = { criterion: string; ai_score: number | null; manual_score: number | null; comment: string };

/**
 * Human review layer over the AI scorecard: a reviewer confirms or overrides
 * each criterion score, annotates, and completes the review. Saved reviews
 * feed the AI-vs-human calibration card on the Analytics page.
 */
export default function ManualQAPanel({ callId, qa }: { callId: string; qa: QAEvaluation | null }) {
  const [existing, setExisting] = useState<ManualQAReview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<"draft" | "completed" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const review = await api.getManualQA(callId).catch(() => null);
      if (cancelled) return;
      setExisting(review);
      setSavedStatus(review?.status ?? null);
      setReviewer(review?.reviewer_name ?? "");
      setNotes(review?.notes ?? "");

      const aiByCriterion = new Map((qa?.criteria ?? []).map((c) => [c.criterion, c.score]));
      if (review && review.criteria.length > 0) {
        setRows(
          review.criteria.map((c) => ({
            criterion: c.criterion,
            ai_score: c.ai_score ?? aiByCriterion.get(c.criterion) ?? null,
            manual_score: c.manual_score,
            comment: c.comment ?? "",
          }))
        );
      } else {
        setRows(
          (qa?.criteria ?? []).map((c) => ({
            criterion: c.criterion,
            ai_score: c.score,
            manual_score: Math.round(c.score),
            comment: "",
          }))
        );
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [callId, qa]);

  const overall = useMemo(() => {
    const scored = rows.filter((r) => r.manual_score != null);
    return scored.length ? scored.reduce((sum, r) => sum + (r.manual_score as number), 0) / scored.length : null;
  }, [rows]);

  const updateRow = (i: number, patch: Partial<RowState>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async (status: "draft" | "completed") => {
    if (!reviewer.trim()) {
      setError("Enter a reviewer name before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveManualQA(callId, {
        reviewer_name: reviewer.trim(),
        status,
        notes: notes || null,
        criteria: rows.map((r) => ({
          criterion: r.criterion,
          ai_score: r.ai_score,
          manual_score: r.manual_score,
          comment: r.comment || null,
        })),
      });
      setExisting(saved);
      setSavedStatus(saved.status);
    } catch (e: any) {
      setError(e.message || "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="text-[12.5px] text-muted py-4">Loading review…</div>;

  if (rows.length === 0) {
    return (
      <div className="text-[12.5px] text-muted py-4">
        Manual review needs the AI scorecard as its baseline — it appears once QA analysis for this call finishes.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-baseline gap-3">
          <div className="font-mono text-[32px] font-semibold tabular" style={{ color: scoreHex(overall ?? 0) }}>
            {overall != null ? overall.toFixed(0) : "—"}
          </div>
          <div className="text-muted text-[12px]">
            manual QA score
            {qa && (
              <span className="ml-2 text-faint">
                AI scored <span className="font-mono tabular">{qa.overall_score.toFixed(0)}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex-1" />
        {savedStatus === "completed" && existing && (
          <Badge tone="good">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Reviewed by {existing.reviewer_name}
            </span>
          </Badge>
        )}
        {savedStatus === "draft" && <Badge tone="warn">Draft review</Badge>}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10.5px] uppercase tracking-wide text-faint font-medium block mb-1">Reviewer</label>
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="Your name"
            className="w-full text-[13px] px-3 py-2 rounded-md border border-hairline bg-panel focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-[10.5px] uppercase tracking-wide text-faint font-medium block mb-1">
            Review notes
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Overall notes (optional)"
            className="w-full text-[13px] px-3 py-2 rounded-md border border-hairline bg-panel focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((r, i) => {
          const isNA = r.manual_score == null;
          const delta = r.ai_score != null && r.manual_score != null ? r.manual_score - r.ai_score : null;
          return (
            <div key={r.criterion} className={`border border-hairline rounded-md px-3.5 py-3 ${isNA ? "opacity-70" : ""}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-[13px] font-medium capitalize">{r.criterion.replace(/_/g, " ")}</div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.ai_score != null && (
                    <span className="text-[11px] text-faint">
                      AI <span className="font-mono tabular text-muted">{r.ai_score.toFixed(0)}</span>
                    </span>
                  )}
                  {delta != null && Math.round(delta) !== 0 && (
                    <span
                      className="text-[11px] font-mono tabular"
                      style={{ color: delta > 0 ? "#12805A" : "#C1352E" }}
                    >
                      {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}
                    </span>
                  )}
                  <span
                    className="font-mono text-[15px] tabular font-medium"
                    style={{ color: isNA ? "#6C7488" : scoreHex(r.manual_score as number) }}
                  >
                    {isNA ? "N/A" : r.manual_score}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={r.manual_score ?? 0}
                  disabled={isNA}
                  onChange={(e) => updateRow(i, { manual_score: Number(e.target.value) })}
                  className="flex-1 accent-[#2F6FED] h-1.5 disabled:opacity-40"
                  aria-label={`Manual score for ${r.criterion}`}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={r.manual_score ?? ""}
                  disabled={isNA}
                  onChange={(e) =>
                    updateRow(i, { manual_score: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                  }
                  className="w-16 text-[12.5px] font-mono tabular px-2 py-1 rounded-md border border-hairline bg-panel focus:outline-none focus:border-accent text-right disabled:opacity-40"
                />
                <label className="flex items-center gap-1.5 text-[11.5px] text-muted cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={isNA}
                    onChange={(e) =>
                      updateRow(i, { manual_score: e.target.checked ? null : Math.round(r.ai_score ?? 70) })
                    }
                    className="accent-[#2F6FED]"
                  />
                  N/A
                </label>
              </div>
              <input
                value={r.comment}
                onChange={(e) => updateRow(i, { comment: e.target.value })}
                placeholder="Comment (optional)"
                className="mt-2 w-full text-[12px] px-2.5 py-1.5 rounded-md border border-hairline bg-panel focus:outline-none focus:border-accent"
              />
            </div>
          );
        })}
      </div>

      {error && <div className="text-[12.5px] text-bad">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => save("completed")}
          disabled={saving}
          className="text-[13px] font-medium px-4 py-2 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Complete review"}
        </button>
        <button
          onClick={() => save("draft")}
          disabled={saving}
          className="text-[13px] font-medium px-4 py-2 rounded-md border border-hairline text-muted hover:text-ink disabled:opacity-50"
        >
          Save draft
        </button>
        {existing?.updated_at && (
          <span className="text-[11.5px] text-faint ml-auto">
            Last saved {new Date(existing.updated_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
