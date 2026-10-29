# Worker Topology & Queue Design

## Broker choice: Redis vs RabbitMQ

**Recommendation: Redis for v1**, with the worker code written against Celery's broker abstraction so switching to RabbitMQ later is a config change, not a rewrite.

- Redis is simpler to operate for a v1/MVP and air-gapped install (single binary, well-understood).
- RabbitMQ's advantage — more sophisticated routing, delivery guarantees, and dead-letter handling — matters more once you're running at genuine "millions of calls/month" scale with complex retry/priority policies. Revisit this once queue depth and retry-failure patterns from production tell you what you actually need, rather than pre-optimizing.
- Whichever is chosen, **Celery's `acks_late=True` + `reject_on_worker_lost=True`** should be standard on every task — a worker crash mid-diarization must not silently drop the job.

## Queue-per-resource-profile

Per ADR-003, queues are split by resource profile, not 1:1 with pipeline stages:

```
queue: gpu-heavy
  - audio.validate
  - audio.denoise
  - diarization.run
  - speech.transcribe

queue: cpu-io
  - llm.analyze          (summary, intent, topic, keywords, root cause, outcome)
  - qa.evaluate
  - compliance.evaluate
  - analytics.sentiment
  - analytics.emotion
  - analytics.conversation
  - analytics.business
  - report.generate

queue: priority-reprocess
  - manual re-run requests from the /calls/{id}/reprocess endpoint
    (separate queue so a bulk reprocess job doesn't starve new uploads)
```

## Task chaining, not monolithic tasks

Each pipeline stage is its own Celery task, chained via Celery `chain()`/`chord()`, **not** one giant task that does everything sequentially in-process. This is what makes per-stage retry actually work — retrying `diarization.run` shouldn't re-run `audio.denoise`.

```
chain(
    audio.validate.s(call_id),
    audio.denoise.s(),
    diarization.run.s(),
    speech.detect_language.s(),
    speech.transcribe.s(),
    speech.align_timestamps.s(),
    transcript.generate.s(),
    pii.detect_and_mask.s(),
    llm.analyze.s(),
    chord(
        [qa.evaluate.s(), compliance.evaluate.s(),
         analytics.sentiment.s(), analytics.emotion.s()],
        analytics.conversation_and_business.s()   # callback, runs after all four
    ),
    timeline.detect.s(),
    observations.generate.s(),
    recommendations.generate.s(),
    search_index.upsert.s(),
).apply_async()
```

The `chord()` around QA/Compliance/Sentiment/Emotion lets those four run in parallel once the LLM analysis pass completes, since none of them depend on each other — this is the biggest easy win for reducing per-call processing latency.

## Idempotency

Every task is keyed on `(call_id, stage)` and checks `processing_jobs` for an existing `succeeded` row before doing work — this makes retries and manual reprocessing safe even if triggered twice concurrently (e.g., a retry firing while the original attempt is still finishing). Each task **upserts** its result row rather than inserting, so a re-run doesn't create duplicate `qa_evaluations` rows for the same call.

## Retry policy

| Stage | Max retries | Backoff | Notes |
|---|---|---|---|
| Audio validate/denoise | 2 | fixed 30s | Fails fast — usually a real file problem, not transient |
| Diarization | 3 | exponential, 60s base | GPU OOM or model load issues are often transient |
| Speech-to-text | 3 | exponential, 60s base | Same as above |
| LLM analysis | 5 | exponential, 15s base | Cloud LLM rate limits are the common failure mode |
| QA / Compliance / Analytics | 5 | exponential, 15s base | Same as LLM — these are LLM calls |
| Report generation | 2 | fixed 30s | Deterministic once inputs exist; failures are usually template/rendering bugs, not transient |

After max retries, the task marks its `processing_jobs` row `failed` with the error message, and the parent `calls.status` becomes `failed` — surfaced on the dashboard's Failed card, not silently dropped.

## Autoscaling signals

- **GPU pool:** scale on queue depth of `gpu-heavy` queue (Celery + Redis exposes this via `llen`), target queue depth per replica configurable per deployment size.
- **CPU/IO pool:** scale on queue depth of `cpu-io` **and** respect the active LLM provider's concurrency/rate limits — no point autoscaling workers faster than the LLM provider can actually serve requests; add a semaphore/rate limiter in front of the LLM provider client itself, shared across worker replicas via Redis, to avoid thundering-herd 429s against cloud providers.

## Observability requirements for workers

- Structured logging (JSON) per task with `call_id`, `stage`, `attempt`, `duration_ms` on every task completion — this is what feeds both operational dashboards and the audit trail.
- Celery task events exported to Prometheus (via `celery-exporter` or similar) — queue depth, task duration histograms, failure rate per stage are the four metrics that matter most for capacity planning conversations.
- A dead-letter view in the admin UI showing all `processing_jobs` rows in `failed` state, filterable by stage — this is the operational surface a support engineer needs day-to-day, not just logs.
