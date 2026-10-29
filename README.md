# AgnoCall — Enterprise AI Call Recording Analysis Platform

Reference implementation of the architecture in the companion design docs
(`01-system-architecture.mermaid` through `07-worker-topology.md`). This is a
**working scaffold**, not the full millions-of-calls production system —
see "What's real vs. simplified" below before you extend it.

## Quick start

```bash
# 1. Optional but recommended: set your OpenAI API key so the LLM
#    analysis stage produces real output instead of failing, and a
#    Deepgram or Google Cloud STT key so transcription is real too.
cp backend/.env.example backend/.env
echo "OPENAI_API_KEY=sk-..." >> backend/.env
echo "DEEPGRAM_API_KEY=..." >> backend/.env
# or, to use Google Cloud Speech-to-Text instead:
# echo "STT_PROVIDER=google" >> backend/.env
# echo "GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json" >> backend/.env

# 2. Bring everything up
docker compose up --build

# 3. Open the app
#    Frontend:       http://localhost:3000
#    API docs:        http://localhost:8000/docs
#    MinIO console:   http://localhost:9001  (AgnoCall / AgnoCall123)
```

Upload a `.wav`/`.mp3`/`.flac`/`.m4a` file from the dashboard. It's stored in
MinIO immediately; a few seconds later the transcript, QA scorecard,
compliance findings, sentiment, and analytics appear on the call detail page.

## Running without Docker (manual setup)

Everything in `docker-compose.yml` is five independent processes — Postgres,
Redis, MinIO, the FastAPI backend, the Celery worker, plus the frontend dev
server. Running them by hand is just starting each one yourself and pointing
`backend/.env` at wherever they end up listening.

### 1. Postgres and Redis

Use whatever local instances you already have, or install fresh ones:

```bash
brew install postgresql@17 redis
brew services start postgresql@17
brew services start redis
createdb callrecording
```

### 2. MinIO — object storage, with the event notification wired up by hand

In `docker-compose.yml`, the `minio-init` service does three things on
container start: creates the bucket, points a webhook notification at the
backend, and subscribes that webhook to object-PUT events. Running MinIO
standalone means doing those three steps yourself, once:

```bash
# Install the server and its CLI
brew install minio/stable/minio minio/stable/mc

# Start the server (pick any local directory for data)
MINIO_ROOT_USER=admin MINIO_ROOT_PASSWORD='Admin@123' \
  minio server ~/minio-data --address :9000 --console-address :9001 &

# Point the mc CLI at it, create the bucket, and wire the webhook
mc alias set local http://localhost:9000 admin 'Admin@123'
mc mb --ignore-existing local/call-recordings
mc admin config set local notify_webhook:pipeline \
  endpoint='http://localhost:8000/api/v1/internal/minio-webhook'

# Restart MinIO so the webhook config takes effect (Ctrl-C the server above,
# then re-run the `minio server` command — the interactive
# `mc admin service restart` command needs a TTY, which won't work if you're
# scripting this)

# Subscribe the bucket to PUT events for each audio extension
for ext in wav mp3 flac m4a; do
  mc event add local/call-recordings arn:minio:sqs::pipeline:webhook \
    --event put --suffix ".$ext"
done
```

Console UI is at `http://localhost:9001` (same credentials) if you'd rather
click through this instead.

### 3. Backend + worker

The worker needs `ffmpeg` — it's used to normalize whatever
codec/container the source audio arrives in (see "Audio normalization"
below) before handing it to an STT provider. `pip install -r requirements.txt`
already bundles a static copy (`imageio-ffmpeg`), which is used when no system
ffmpeg is found on `PATH` or in `FFMPEG_PATH`. A system install is still
preferred (faster, patched by your OS):

```bash
brew install ffmpeg
```

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql+psycopg://<user>@localhost:5432/callrecording
#   REDIS_URL=redis://localhost:6379/0
#   MINIO_ENDPOINT=localhost:9000
#   MINIO_PUBLIC_ENDPOINT=localhost:9000
#   MINIO_ACCESS_KEY=admin
#   MINIO_SECRET_KEY=Admin@123
#   MINIO_BUCKET=call-recordings
#   OPENAI_API_KEY=...            (optional but recommended)
#   DEEPGRAM_API_KEY=...          (optional but recommended)

# Terminal 1 — API server (also self-heals the DB schema on startup, see
# "Schema management" below)
uvicorn app.main:app --reload

# Terminal 2 — same venv, runs the actual pipeline stages (transcription,
# LLM analysis, QA, compliance, ...)
celery -A app.tasks.celery_app worker --loglevel=info -Q celery,cpu-io,gpu-heavy

# Terminal 3 — same venv, dedicated worker for priority-reprocess + Celery
# Beat (-B). Kept as a separate process, not just a separate queue on the
# worker above, so a slow LLM-analysis task (10s+ per call, longer for
# multi-minute recordings) never delays sync_call_records' 1s poll or the
# stale-processing reaper — see "Pipeline robustness guards" below.
celery -A app.tasks.celery_app worker --loglevel=info -B -Q priority-reprocess --concurrency=2
```

#### Windows (PowerShell)

Celery's default prefork pool and the `-B` flag don't work on Windows
(symptoms: `PermissionError: [WinError 5] Access is denied`,
`OSError: [WinError 6] The handle is invalid`, or `-B option does not work on
Windows`). Use the threads pool and run Beat as its own process. Open a new
terminal after installing ffmpeg so the updated `PATH` is picked up.

```powershell
# One-time setup
winget install Gyan.FFmpeg
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env        # then edit .env as above

# Terminal 1 — API server
uvicorn app.main:app --reload

# Terminal 2 — pipeline stages (transcription, LLM analysis, QA, ...)
celery -A app.tasks.celery_app worker --loglevel=info -Q celery,cpu-io,gpu-heavy --pool=threads --concurrency=4 -n main@%h

# Terminal 3 — priority-reprocess worker (MinIO poll + stale-call reaper)
celery -A app.tasks.celery_app worker --loglevel=info -Q priority-reprocess --concurrency=2 --pool=threads -n prio@%h

# Terminal 4 — Celery Beat scheduler (replaces -B)
celery -A app.tasks.celery_app beat --loglevel=info
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

### 5. Load testing (`backend/scripts/load_test.py`)

Seeds calls concurrently and reports per-stage latency (from `ProcessingJob`
timestamps), success/failure counts, and Celery queue depth / Postgres
connection pressure sampled over the run. Two stages:

```bash
cd backend
source venv/bin/activate

# Free, local-only: seeds 500 calls at concurrency 40 against
# STT_PROVIDER=mock / LLM_PROVIDER=mock (set those env vars on the
# uvicorn/celery processes first) to find Celery/Postgres/MinIO capacity
# limits without spending anything.
python scripts/load_test.py --stage mock --seed-mode direct

# Costs real money: seeds a small number of calls (default 15, concurrency 3)
# against whatever STT/LLM providers are actually configured in .env --
# gated behind a typed confirmation before it does anything.
python scripts/load_test.py --stage real

# Removes everything a run created (tagged `loadtest-<run_id>` on the Agent
# row) — DB rows and MinIO objects both.
python scripts/load_test.py --cleanup <run_id>
```

`--seed-mode http` (the default) exercises the real `POST /calls` endpoint;
`--seed-mode direct` bypasses it and inserts `Call` rows / enqueues
`run_pipeline` directly. Prefer `direct` for the mock stage — as of this
writing, `POST /calls` does blocking synchronous I/O (MinIO put, DB commit)
inside an `async def` handler, so it serializes on FastAPI's single
event-loop thread; concurrency around 40 wedges the server into total
unresponsiveness rather than just slowing down (confirmed: required a hard
kill to recover). Low concurrency (≤5) is fine with `http`. Test audio is
synthesized on the fly via macOS `say` (falls back to a silent tone off
macOS, fine for `--stage mock` since `MockSTTProvider` ignores audio
content) — a real STT provider needs actual words, or the pipeline's
no-speech guard correctly rejects it before ever reaching the LLM stage.
Defaults to a random 5–10 minute call length (`--audio-duration` to
override) to match realistic production call durations.

### Proving the event-driven path works without the app's own upload button

```bash
mc cp some-call.wav local/call-recordings/calls/$(uuidgen)/original.wav
```

This alone won't do anything useful yet — the webhook handler only enqueues
processing for a `call_id` that already has a row in `calls` with
`status = uploaded` (see the next section), so this command is really only
useful once a bulk-import job is creating that row itself before writing the
object. For everyday manual testing, just upload through the dashboard.

## How "whenever data lands in MinIO, the app reacts" actually works

Two things happen on upload, deliberately redundant so the demo works
immediately but the _real_ trigger is storage-event-driven, not just
"the upload endpoint happened to also enqueue a job":

1. `POST /api/v1/calls` writes the audio to MinIO under `calls/{call_id}/original.ext`
   and — as a dev convenience — also enqueues the pipeline directly.
2. MinIO itself is configured (via the `minio-init` service in
   `docker-compose.yml`, or by hand per the section above) to call
   `POST /api/v1/internal/minio-webhook` the instant that object finishes
   writing. That webhook is what a bulk-import job or a direct MinIO write
   (bypassing the API entirely) would rely on — the API upload path is a
   convenience, MinIO's own event notification is the source of truth.

The webhook handler (`app/api/internal.py`) matches the object key against
`calls/{uuid}/...`, looks up that `call_id`, and enqueues `run_pipeline` only
if a `Call` row already exists with `status = uploaded` — it does not create
one on the fly. MinIO also URL-encodes the key in its event payload (e.g.
`calls%2F{uuid}%2Foriginal.wav`), which the handler decodes before matching.
That means the reactive trigger fires correctly for anything the app itself
uploaded (which always creates the DB row first), but a file dropped into the
bucket by an external process with no matching `Call` row is silently
ignored — that's the gap to close if you want a true "just drop files into
MinIO and the app picks them up from nothing" workflow.

You can prove the webhook fires end-to-end yourself:

```bash
mc cp some-call.wav local/call-recordings/calls/{uuid}/original.wav
```

and watch it get picked up and processed without ever calling the upload API
— as long as `{uuid}` already exists as a `Call` row in `uploaded` status.

## What's real vs. simplified

| Piece                                                                               | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MinIO upload, storage, presigned-URL playback                                       | **Real** — browser streams directly from MinIO, backend never proxies audio bytes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| MinIO event-driven pipeline trigger                                                 | **Real** — configured webhook, not just an API-side enqueue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Postgres schema, API, Celery/Redis wiring                                           | **Real** and runnable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LLM analysis (summary, intent, QA, compliance, sentiment, emotion, recommendations) | **Real** — calls the OpenAI API with the transcript, provided `OPENAI_API_KEY` is set. Falls back to Ollama if `DEPLOYMENT_MODE=air_gapped`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Speech-to-text / diarization                                                        | **Real** — `DeepgramProvider` or `GoogleSTTProvider` (pick via `STT_PROVIDER=deepgram\|google`) transcribe and diarize the uploaded audio, provided the matching API key/credentials are set. Falls back to `MockSTTProvider` (a varied, realistic synthetic support-call transcript) if no credentials are configured, so the rest of the pipeline still has content to analyze. Swap in `FasterWhisperProvider` for a local/air-gapped deployment — see `app/tasks/providers.py`.                                                                                                                                                                                      |
| Worker parallelism (chord/chain across queues)                                      | **Partially real** — `priority-reprocess` runs as a genuinely separate worker process/pod from `gpu-heavy`/`cpu-io` (`docker-compose.yml`'s `worker-priority` service, `backend/deployment.yaml`'s second Deployment), so a slow LLM-analysis task can't delay the sync poller or the stale-processing reaper. Within a call, `run_pipeline` still runs its stages as ordered function calls in one task rather than a `chain()`/`chord()` — `07-worker-topology.md` shows that production shape (QA/Compliance/Sentiment/Emotion fanned out in parallel once LLM analysis completes); the stage functions here are already split 1:1 to make that promotion mechanical. |
| Qdrant, OpenSearch, global search, Kubernetes                                       | **Not included** — deferred per ADR-002 and the "what I can/can't build here" discussion. The API contract (`05-api-contracts.yaml`) already reserves the `/search` endpoint shape for when you add it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## How it works, technically

### Architecture at a glance

Next.js frontend ↔ FastAPI backend (`/api/v1`) ↔ Postgres (all structured
data) + Redis (Celery broker/result backend) + MinIO (raw audio blobs only)

- external AI APIs (OpenAI for analysis, Deepgram/Google Cloud Speech for
  transcription). The frontend and backend are the only two processes a
  browser or API client ever talks to directly; Postgres/Redis/MinIO are
  internal to the backend and Celery worker.

### Request flow: upload → processed report

1. Browser sends `POST /api/v1/calls` (multipart). The backend looks up or
   creates an `Agent` row if agent info was given, creates a `Call` row
   (`status = uploaded`), streams the file into MinIO under
   `calls/{call_id}/original.{ext}`, then returns `{call_id, status}`
   immediately — it does not wait for processing.
2. Three independent things can enqueue the pipeline for the same call (see
   the MinIO section above for why): the upload endpoint itself, MinIO's own
   PUT event webhook, and `sync_call_records` (a 1s poll-based fallback).
   `run_pipeline` claims a call atomically (`uploaded`/`validating` →
   `processing`, a conditional `UPDATE ... WHERE status = ...`, not a
   read-then-branch) before doing any work, so only one of those ever
   actually processes a given call — the rest see zero rows affected and
   exit as a no-op instead of wiping and reprocessing an already-processed
   call. See "Pipeline robustness guards" below.
3. The main worker (subscribed to `gpu-heavy`/`cpu-io`) picks up
   `run_pipeline(call_id)` and runs the stages below, in order, inside one
   task. Each stage commits its own rows before the next stage starts, so
   partial progress survives a crash mid-pipeline.
4. Once every stage finishes, `Call.status` flips to `processed`. The
   frontend has no websocket/push channel — refresh the call-detail page to
   see results appear.

### Pipeline stages (`app/tasks/pipeline.py::run_pipeline`)

1. **Transcribe** — audio is normalized (see below) then handed to
   `get_stt_provider()`, which selects Deepgram, Google Cloud Speech, or a
   synthetic mock transcript generator based on `STT_PROVIDER` and which API
   key is configured. Returns diarized segments (`speaker_role`,
   `start_time`, `end_time`, `text`, `confidence`).
2. **LLM analysis** — one call to `get_llm_provider().generate_json()`
   (OpenAI, or Ollama for air-gapped deployments) with the full transcript,
   requesting a single large structured JSON document: summaries,
   intent/topic/keywords, QA scores against a 9-criteria rubric, compliance
   violations, sentiment/emotion timelines, timeline events, coaching
   recommendations, customer-info extraction, call classification, and
   smart labels (urgent/escalation/follow-up/etc) — one round trip rather
   than a call per concern, to keep latency and cost down.
3. **QA persistence** — averages per-criterion scores into `overall_score`,
   writes `QAEvaluation` + `QACriteriaScore` rows.
4. **Compliance persistence** — one `ComplianceViolation` row per flagged
   rule, each citing a transcript timestamp and evidence quote.
5. **Extraction/classification/labeling persistence** — writes
   `CallExtraction` (customer name/phone/email/account, call reason,
   resolution), `CallClassification` (category/complexity), and one
   `CallLabel` row per label the LLM marked true.
6. **Sentiment/emotion persistence** — `SentimentAnalysis` and
   `EmotionAnalysis` rows straight from the LLM's structured output.
7. **Analytics** — computed in code, not trusted to the LLM, since these are
   objectively measurable from segment timing: talk-time ratios and
   interruption count, pause detection (3–7s gap = "notable", 7s+ =
   "excessive", 15s+ also counts as hold time), and a weighted composite
   0–100 `health_score` combining QA score, talk balance, interruptions, and
   pause behavior.
8. **Timeline & recommendations persistence** — `TimelineEvent`,
   `AIObservation`, and `Recommendation` rows.

### Pipeline robustness guards

Properties `run_pipeline` and its supporting tasks enforce beyond the happy
path, in `app/tasks/pipeline.py` and `app/tasks/sync.py`:

- **Audio normalization.** Every upload is transcoded via `ffmpeg` to plain
  16kHz mono PCM WAV (`_normalize_audio()`) before any STT provider sees it,
  regardless of the source file's actual container/codec. This matters a lot
  for this pipeline's primary intended source — PBX/SIP call recordings —
  which commonly arrive as G.729 or other bandwidth-saving codecs, sometimes
  wrapped in vendor-specific WAV variants with extra non-standard chunks.
  Deepgram/Google's WAV parsers and Python's own `wave` module only handle a
  narrow set of formats directly; ffmpeg's decoder library is far more
  complete, so normalizing once here means no STT provider integration has
  to special-case source codecs. Requires `ffmpeg` on the worker's `PATH`
  (installed via the Dockerfile for `docker compose`, or `brew install
ffmpeg` for the manual setup above).
- **No-speech guard.** If the normalized audio transcribes to fewer than 5
  total words (`_has_meaningful_speech()`), the pipeline refuses to call the
  LLM at all and marks the call `failed` with a clear reason. This exists
  because an LLM asked to fill in a fixed JSON shape (customer name, QA
  scores, resolution summary, ...) from an empty or near-empty transcript
  will often fabricate a plausible-looking answer rather than say "no data,"
  unless a hard stop prevents the call from happening in the first place —
  refusing to analyze is the only actual guarantee against that, since even
  a well-worded prompt is a probabilistic mitigation, not a guarantee.
- **Duplicate-processing guard.** Three independent things can enqueue
  `run_pipeline` for the same call (the upload endpoint, the MinIO webhook,
  and the 1s `sync_call_records` poll) — all of them can see `status =
uploaded` and fire before the _first_ enqueued task actually starts, since
  status only flips once a run begins, not once it's queued. `run_pipeline`
  claims the call atomically (`uploaded`/`validating` → `processing`, a
  conditional `UPDATE ... WHERE status = ...`, not a read-then-branch, which
  still races) before touching anything — every duplicate invocation sees
  zero rows affected and exits immediately instead of wiping and
  reprocessing an already-`processing`/`processed` call.
  `_clear_previous_results()` still exists and still clears a call's prior
  rows, but only runs for whichever invocation actually won the claim, so it
  now only matters for a genuine re-run (e.g. a call deliberately reset to
  `uploaded`), not for defending against concurrent duplicates.
- **Enqueue-side dedup (`validating` status).** The webhook and
  `sync_call_records` additionally claim a call to `validating`
  (`app/tasks/call_ingest.py::claim_for_enqueue()`) the moment they decide to
  enqueue it, not just when the task starts — otherwise a call sitting in a
  busy `cpu-io` backlog gets re-enqueued on every single 1s poll tick for as
  long as it's queued (confirmed live: ~11 real calls each generating a
  fresh duplicate Celery message every second while queued). This doesn't
  change correctness (the claim above already makes duplicates harmless) but
  avoids the redundant message/DB-query churn.
- **Stale-processing recovery.** A call whose worker died mid-task (SIGKILL,
  OOM, host restart) never reaches `run_pipeline`'s `except` block, so
  nothing else ever moves it off `processing`/`validating` — confirmed live:
  a Redis restart lost the unacked message for two real calls, which then
  sat stuck for 2+ days. `reap_stale_processing` (Celery Beat, every 5 min,
  `app/tasks/sync.py`) finds calls with no `ProcessingJob` activity for over
  5 minutes and re-enqueues them directly (capped at 3 automatic attempts
  via `call_metadata.stale_reap_count`, then marked `failed` with a clear
  reason) — it re-enqueues directly rather than resetting to `uploaded` and
  hoping `sync_call_records` rediscovers it, since that poller only scans
  the last 2 days of MinIO date-prefixes and would never see an older stuck
  call again.

### Provider abstraction (ADR-001)

Every STT/LLM provider declares which `deployment_mode`s it's compatible
with (`cloud` / `air_gapped` / `hybrid`), and the `get_stt_provider()`/
`get_llm_provider()` factory functions in `app/tasks/providers.py` refuse to
return an incompatible one — this is what makes it structurally impossible
for an air-gapped org to accidentally call a cloud API, rather than relying
on a caller to remember a runtime check.

### Storage split: MinIO vs. Postgres

MinIO holds only the raw audio bytes. Everything else — transcript text,
scores, violations, analytics, extracted fields — lives in Postgres. The
browser never downloads audio through the backend: `GET /calls/{id}/audio`
returns a short-lived MinIO presigned URL, and the audio player streams
directly from MinIO. The backend's only job for audio is "accept the upload,
mint the URL."

### Schema management

There's no Alembic migration set up yet. `app/main.py`'s startup hook calls
`Base.metadata.create_all()` (creates any missing tables) plus a small
incremental-column guard (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for
columns added to already-existing tables, since `create_all()` alone won't
do that). In practice this means restarting the backend after pulling a
newer version of this repo is usually enough to pick up schema changes in
dev. A real deployment should replace both with `alembic upgrade head`.

### API layer

FastAPI routers under `/api/v1`: `calls` (upload, list, and per-call
transcript/QA/compliance/sentiment/emotion/analytics/extraction/
classification/labels/pauses/observations/recommendations), `dashboard`
(org-wide summary), `agents` (leaderboard + per-agent detail), `compliance`
(org-wide violation summary), and `internal` (the MinIO webhook, hidden from
the OpenAPI schema). Every response shape is a Pydantic model in
`app/schemas/schemas.py`.

### Frontend

Next.js App Router. Most pages (`/`, `/calls`, `/agents`, `/compliance`) are
server components that `await` the typed API client (`lib/api.ts`) directly
and render server-side. The call-detail page (`/calls/[id]`) is the one
fully client-side view, since it needs interactivity — tab switching, audio
seek, jump-to-timestamp from transcript/QA/compliance evidence. `recharts`
(charts) and `lucide-react` (icons) are the only UI dependencies beyond
Tailwind — there's no component library.

## Project layout

```
backend/
  app/
    core/         config, db session
    models/       SQLAlchemy models (matches 03-database-erd.mermaid)
    schemas/      Pydantic response models
    api/          calls, dashboard, agents, compliance, internal (MinIO webhook)
    storage/      minio_client.py — upload / presigned URL / download
    tasks/        celery_app, pipeline (orchestration), providers (STT/LLM abstraction),
                  sync (MinIO poll fallback + stale-processing reaper), call_ingest
  scripts/        load_test.py — see "Load testing" above
frontend/
  app/            Next.js App Router pages — dashboard, calls list, call detail,
                  compliance, agents (+ agent detail)
  components/     AudioPlayer, QAScorecard, ComplianceList, TranscriptView,
                  UploadDropzone, CallOverviewCard, SentimentEmotionPanel,
                  InsightsPanel, PauseList, charts/ (recharts components),
                  shared primitives (Badge, EmptyState, Skeleton, PageContainer)
  lib/api.ts      typed API client
```

## Extending toward production scale

Follow the ADRs in `06-architecture-decisions.md` in order:

1. Split `run_pipeline`'s stage functions into standalone `@celery_app.task`s
   chained via `chain()`/`chord()` per `07-worker-topology.md` — QA,
   Compliance, Sentiment, and Emotion can run in parallel once LLM analysis
   completes.
2. Implement `FasterWhisperProvider` and a diarization stage using
   `pyannote.audio` for real transcription (GPU-bound — put it on the
   `gpu-heavy` queue).
3. Add Qdrant + a semantic-search resolution path once "find similar calls"
   is a real requirement (ADR-002).
4. Move from `Base.metadata.create_all` (dev convenience, in `main.py`) to
   Alembic migrations before touching a real database.
5. Add the QA-template and compliance-rule-authoring UI described in
   ADR-005/ADR-006 — right now the rule set and scorecard criteria are
   hardcoded constants in `app/tasks/pipeline.py`.
