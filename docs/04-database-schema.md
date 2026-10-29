# Database Schema — Design Notes

Companion to `03-database-erd.mermaid`. Postgres is the system of record for everything except raw audio/report binaries (MinIO) and full-text/semantic search indexes (OpenSearch/Qdrant), which are derived and rebuildable from Postgres.

## Table groups and rationale

### 1. Tenancy & Identity
`organizations`, `users`, `roles`, `agents`

- Every table below carries `org_id` directly or transitively through `call_id` — enforce row-level security (RLS) in Postgres at the `org_id` boundary rather than relying solely on application-layer filtering. This matters a lot for a platform that will eventually host multiple enterprise tenants or business units.
- `organizations.deployment_mode` drives which `provider_configs` rows are selectable in the UI — an air-gapped org should never even see cloud provider options, not just be blocked from using them.
- `agents` is deliberately separate from `users`. Agents are the people being evaluated; users are the people using the platform (QA managers, supervisors, compliance). An agent may never log into the platform at all — their record exists purely as an analytics subject, populated via `external_agent_id` from an HR/WFM feed or CSV import.

### 2. Call lifecycle
`calls`, `processing_jobs`

- `calls.status` is the coarse state (`uploaded → validating → processing → processed → failed`). `processing_jobs` is the fine-grained per-stage state — this separation is what makes the pipeline **idempotent and retry-safe**: if the Compliance Worker crashes, you retry only that job row, not the whole call.
- `processing_jobs.attempt_count` + `error_message` gives you the audit trail for "why did this call fail" without polluting the `calls` table with 8 sets of stage-specific failure columns.
- Recommend a unique constraint on `(call_id, stage)` with an `attempt_count` increment on retry, not a new row per attempt — keeps the row count sane at millions-of-calls scale.

### 3. Transcript
`transcripts`, `transcript_segments`, `speakers`

- Masked and unmasked text are **separate columns**, not a single column with a "reveal PII" toggle computed at read time. This lets you apply column-level encryption + a stricter RLS policy on `full_text_unmasked` / `text_unmasked` independent of the masked version, which most viewers should default to.
- `transcript_segments.sequence` (not just timestamps) makes UI rendering trivial and cheap — you don't need to sort by float timestamps on every read.
- `speakers.role` starts as `unknown` and gets resolved by the LLM worker's role-identification pass (agent vs. customer) — diarization only gives you "Speaker A/B," not who's who.

### 4. QA
`qa_scorecard_templates`, `qa_evaluations`, `qa_criteria_scores`

- Scorecards are **templated and versioned per org**, not hardcoded to the 9 criteria in the spec. Different verticals (collections vs. tech support vs. sales) weight criteria differently — `criteria_definitions` jsonb holds the weight/description per criterion, and `qa_evaluations.template_id` pins each evaluation to the template version used, so historical scores stay comparable even after a template edit.
- `qa_criteria_scores` is one row per criterion (not columns on `qa_evaluations`) specifically so the explainability requirement — score + explanation + timestamp + evidence + confidence — is a first-class, queryable record. This is what powers "show me every call where empathy scored below 80" in global search.
- `reviewed_by_human` supports the human-in-the-loop override that every serious QA program eventually needs — supervisors will disagree with the AI score sometimes, and that disagreement itself is a data point worth keeping, not overwriting.

### 5. Compliance
`compliance_rules`, `compliance_violations`

- This is the **compliance-as-code** table pair discussed earlier. `compliance_rules.rule_logic` stores the natural-language rule text an org's compliance team authors; a separate compilation step (not shown here — belongs in the LLM Worker's prompt construction) turns that into detection instructions. Keeping the authored rule and the detection logic separated means legal/compliance can review and version rule *text* without needing to understand prompts.
- `jurisdiction` on `compliance_rules` supports the regulatory-diffing feature — a call tagged with a US state or country in `calls.metadata` can be matched against only the rules applicable to that jurisdiction.
- `compliance_violations.review_outcome` mirrors the QA override pattern — every AI-flagged violation should be confirmable/dismissible by a human, and that outcome should feed back into rule tuning over time.

### 6. Sentiment & Emotion
`sentiment_analysis`, `emotion_analysis`

- Timelines are stored as `jsonb` arrays rather than a normalized "one row per data point" table. Given the array size is bounded (one point per N seconds of a call that's typically under an hour), the query pattern is almost always "fetch the whole timeline for one call," which jsonb serves fine — normalizing this would add join overhead for no real benefit. Reconsider if you later need to query *across* calls at the timeline-point level (e.g., "show me all emotion spikes above threshold X across the whole org") — that access pattern would justify a normalized table or a shift to a time-series store.

### 7. Analytics
`conversation_analytics`, `agent_analytics`, `customer_analytics`

- Split three ways because they have different **update cadence and audiences**: conversation analytics are purely derived from the call and never change; agent analytics may later be recomputed if scoring weights change; customer analytics (churn risk, CSAT prediction) are the ones most likely to get a "model v2" retraining pass. Keeping them in separate tables means you can version/backfill one without touching the others.
- `agent_analytics` duplicates some numbers conceptually available via aggregation (e.g., could compute average empathy across calls), but storing per-call is what makes the Agent Analytics dashboard fast — don't aggregate 10,000 QA rows on every dashboard load.

### 8. Timeline, Observations, Recommendations, Actions
`timeline_events`, `ai_observations`, `recommendations`, `action_items`

- `timeline_events` powers the click-to-jump UI requirement directly — each row is a clickable chapter marker with `start_time`.
- `recommendations.category` distinguishes immediate/coaching/KB/SOP/follow-up because these route to **different owners** in a real deployment (a KB-improvement recommendation should eventually be exportable to a knowledge-base ticket, not just sit in a report).

### 9. Reports & Audit
`reports`, `audit_logs`

- `reports` stores generated exports as MinIO object references, not blobs in Postgres — Postgres holds metadata (who requested it, when, what format), MinIO holds the file.
- `audit_logs` should be **append-only** (no UPDATE/DELETE grants at the DB role level) and should log every read of unmasked PII, every report export, every compliance-violation review outcome, and every settings change — this table is what an actual compliance audit will be run against.

## Indexing priorities (v1)

- `calls (org_id, status, uploaded_at)` — dashboard queries filter on all three constantly
- `calls (org_id, agent_id)` — agent-level drill-down
- `qa_criteria_scores (criterion, score)` — powers "show me calls where X scored below Y"
- `compliance_violations (call_id, severity)` — compliance dashboard
- `transcript_segments (transcript_id, sequence)` — ordered read pattern
- Full-text search itself should NOT run against Postgres at scale — that's OpenSearch's job; Postgres only needs indexes that support the structured dashboard/filter queries.

## Migration strategy

Use Alembic with one migration per table group above, not one giant initial migration — this keeps the migration history reviewable and makes it much easier to add QA-template versioning or new compliance-rule jurisdictions later without an unreadable diff.
