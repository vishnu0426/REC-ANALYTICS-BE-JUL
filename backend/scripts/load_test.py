#!/usr/bin/env python3
"""
Load-test harness for the call-recording pipeline.

Two stages:
  --stage mock   Seeds calls with STT_PROVIDER=mock / LLM_PROVIDER=mock running
                 server-side (set those env vars on the uvicorn/celery
                 processes before running). Free, local-only — finds Celery
                 queue backup, Postgres connection pressure, ffmpeg/CPU
                 saturation on the current worker process.
  --stage real   Seeds a small number of calls against whatever STT/LLM
                 providers are actually configured in .env (live Deepgram/
                 OpenAI by default in this repo). Spends real money — gated
                 behind an explicit typed confirmation.

Two seed modes (--seed-mode):
  http    (default) POSTs to the real POST /calls endpoint, exercising the
          full upload path. NOTE: as of this writing that endpoint does
          blocking synchronous I/O (MinIO put, DB commit) inside an `async
          def` handler, so it serializes on FastAPI's single event-loop
          thread — at concurrency ~40 it wedges the server into total
          unresponsiveness (confirmed: required a hard kill to recover, GET
          /docs hung for ~8s then failed) rather than just slowing down. Use
          low concurrency (<=5) with this mode until that's fixed.
  direct  Bypasses HTTP entirely: inserts Call rows, uploads to MinIO, and
          calls run_pipeline.delay() directly from a thread pool sized to
          --concurrency. Use this to measure Celery/Postgres/MinIO capacity
          in isolation from the upload-endpoint bottleneck above.

Run from backend/ with the same venv as the Celery worker:
    python scripts/load_test.py --stage mock --seed-mode direct
    python scripts/load_test.py --stage real
    python scripts/load_test.py --cleanup <run_id>

Caveat: this only characterizes the single local Celery worker process
running on this machine (no --concurrency flag set anywhere, so it defaults
to CPU-core count; worker_prefetch_multiplier=1). Production
(backend/deployment.yaml) runs one k8s pod, replicas=1, worker limited to
1000m CPU / 1Gi — these numbers are not a production capacity estimate.
"""
import argparse
import asyncio
import random
import shutil
import statistics
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from collections import defaultdict
from pathlib import Path

import httpx
import redis as redis_lib
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.models import (
    Agent, Call, CallStatus, ProcessingJob, ManualQAReview, ManualQACriteriaScore,
    QAEvaluation, QACriteriaScore, Transcript, TranscriptSegment,
    ComplianceViolation, SentimentAnalysis, EmotionAnalysis,
    ConversationAnalytics, CustomerAnalytics, TimelineEvent,
    AIObservation, Recommendation, CallExtraction, CallClassification,
    CallLabel, PauseEvent, CallInsight,
)
from app.storage import minio_client
from app.tasks.pipeline import run_pipeline

settings = get_settings()

QUEUES = ("gpu-heavy", "cpu-io", "priority-reprocess")


# Varied call-center sentences, repeated/cycled as needed to reach a target
# duration -- a single short sentence looped verbatim would work for STT
# (Deepgram doesn't care about repetition) but produces a degenerate
# transcript for the LLM stage (real "call" durations should look like a
# real conversation, not one line repeated 40 times).
_TEST_SPEECH_BLOCKS = [
    "Hello, thank you for calling support. I understand you have a question about your recent order.",
    "Let me look into that for you right away. I can see the details here and everything looks correct.",
    "Can you confirm the email address on the account for me please.",
    "Great, thank you. I've located your account and I can see the order was placed last week.",
    "It looks like there was a delay with the shipping carrier, but it should arrive within two business days.",
    "I understand that's frustrating, and I apologize for the inconvenience this has caused you.",
    "I'm going to apply a service credit to your account for the delay, which you'll see on your next statement.",
    "Is there anything else I can help you with today regarding this order or your account.",
    "I also want to make sure you know about our loyalty program, which offers additional discounts going forward.",
    "Thank you so much for your patience while we sorted this out, we really appreciate your business.",
    "Please don't hesitate to reach out again if you run into any further issues with the shipment.",
    "Thank you for calling, have a great day, and take care.",
]

# Empirically ~300 words per minute at macOS `say`'s default rate (a 75-word
# block rendered to 14.88s in testing) -- 5.0 words/sec, plus ~15% headroom
# so the generated text always comfortably exceeds the target duration and
# ffmpeg's -t trims it down to an exact length rather than falling short.
_WORDS_PER_SECOND = 5.75


def _build_long_speech(duration_s: int) -> str:
    words_needed = int(duration_s * _WORDS_PER_SECOND)
    blocks, total_words, i = [], 0, 0
    while total_words < words_needed:
        block = _TEST_SPEECH_BLOCKS[i % len(_TEST_SPEECH_BLOCKS)]
        blocks.append(block)
        total_words += len(block.split())
        i += 1
    return " ".join(blocks)


def make_test_audio(duration_s: int = None) -> tuple[bytes, int]:
    """
    Synthesizes test audio with no dependency on any pre-existing sample
    file. Prefers macOS's `say` to generate real speech: a tone-only clip has
    no words, so a real STT provider correctly transcribes it as empty and
    the pipeline's legitimate no-speech guard (NoSpeechDetected in
    pipeline.py) rejects it before ever reaching the LLM stage -- useless for
    exercising --stage real. Falls back to a sine tone off macOS, which is
    still fine for --stage mock since MockSTTProvider ignores audio content.

    duration_s: target length in seconds. Defaults to a random 5-10 minute
    call (300-600s) to match realistic production call lengths (this
    session's earlier investigation of real calls found durations ranging
    12s-994s) -- pass an explicit value for a quicker/cheaper test run.

    Returns (audio_bytes, duration_s) rather than just bytes: `ffmpeg ... -f
    wav pipe:1` cannot seek back on a pipe to patch the RIFF header's data
    size once done, so it writes a placeholder (confirmed: 0xFFFFFFFF) --
    Python's `wave` module then reports a garbage frame count if you try to
    re-derive duration from the header afterward. The actual audio pipeline
    is unaffected (it reads buffered bytes directly, never trusts that
    header field), but callers here that want to *know* the duration (e.g.
    the cost-estimate banner) must use the value that was actually requested,
    not re-parse it from the file.
    """
    if duration_s is None:
        duration_s = random.randint(300, 600)

    if shutil.which("say"):
        text = _build_long_speech(duration_s)
        with tempfile.NamedTemporaryFile(suffix=".aiff") as f:
            subprocess.run(["say", "-o", f.name, text], check=True, timeout=180)
            proc = subprocess.run(
                ["ffmpeg", "-y", "-i", f.name, "-t", str(duration_s),
                 "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"],
                capture_output=True, timeout=60,
            )
    else:
        proc = subprocess.run(
            ["ffmpeg", "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration_s}",
             "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"],
            capture_output=True, timeout=60,
        )
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"failed to synthesize test audio: {proc.stderr.decode(errors='replace')[-300:]}")
    return proc.stdout, duration_s


async def seed(run_id: str, n: int, concurrency: int, base_url: str, audio_bytes: bytes):
    sem = asyncio.Semaphore(concurrency)
    call_ids = []
    errors = []

    async def upload(i, client):
        async with sem:
            files = {"file": (f"loadtest-{run_id}-{i}.wav", audio_bytes, "audio/wav")}
            data = {"agent_external_id": f"loadtest-{run_id}", "agent_name": f"LoadTest-{run_id}"}
            try:
                resp = await client.post(f"{base_url}/calls", files=files, data=data, timeout=60)
                resp.raise_for_status()
                call_ids.append(resp.json()["call_id"])
            except Exception as e:
                errors.append(str(e))

    async with httpx.AsyncClient() as client:
        await asyncio.gather(*(upload(i, client) for i in range(n)))

    return call_ids, errors


def _create_one_sync(run_id: str, i: int, agent_id: str, audio_bytes: bytes) -> str:
    """Synchronous equivalent of POST /calls's handler body — same sequence
    (insert Call, upload to MinIO, commit, enqueue), run in a worker thread
    by seed_direct() so it doesn't block an event loop the way the real
    endpoint currently does."""
    db = SessionLocal()
    try:
        filename = f"loadtest-{run_id}-{i}.wav"
        call = Call(original_filename=filename, storage_path="", status=CallStatus.uploaded, agent_id=agent_id)
        db.add(call)
        db.flush()
        key = minio_client.upload_audio(call.id, filename, audio_bytes, "audio/wav")
        call.storage_path = key
        db.commit()
        call_id = call.id
    finally:
        db.close()
    run_pipeline.delay(call_id)
    return call_id


async def seed_direct(run_id: str, n: int, concurrency: int, audio_bytes: bytes):
    """Bypasses POST /calls entirely (see module docstring for why) — inserts
    Call rows and enqueues run_pipeline.delay() directly from a thread pool
    sized to `concurrency`, to measure Celery/Postgres/MinIO capacity without
    the upload-endpoint bottleneck as a confound."""
    db = SessionLocal()
    agent = Agent(external_agent_id=f"loadtest-{run_id}", name=f"LoadTest-{run_id}")
    db.add(agent)
    db.commit()
    agent_id = agent.id
    db.close()

    from concurrent.futures import ThreadPoolExecutor
    call_ids = []
    errors = []
    executor = ThreadPoolExecutor(max_workers=concurrency)
    loop = asyncio.get_running_loop()
    sem = asyncio.Semaphore(concurrency)

    async def worker(i):
        async with sem:
            try:
                call_id = await loop.run_in_executor(executor, _create_one_sync, run_id, i, agent_id, audio_bytes)
                call_ids.append(call_id)
            except Exception as e:
                errors.append(str(e))

    await asyncio.gather(*(worker(i) for i in range(n)))
    executor.shutdown(wait=True)
    return call_ids, errors


class Sampler:
    """Background poller: records Celery queue depth + Postgres connection
    count every ~1s during a run, so the report shows queue backup / pool
    pressure building over time, not just end totals."""

    def __init__(self, interval_s: float = 1.0):
        self.interval_s = interval_s
        self._stop = threading.Event()
        self.samples = []
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=5)

    def _run(self):
        r = redis_lib.Redis.from_url(settings.redis_url)
        while not self._stop.is_set():
            try:
                queue_depths = {q: r.llen(q) for q in QUEUES}
            except Exception:
                queue_depths = {}
            try:
                db = SessionLocal()
                pg_conns = db.execute(
                    text("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()")
                ).scalar()
                db.close()
            except Exception:
                pg_conns = None
            self.samples.append((time.time(), queue_depths, pg_conns))
            self._stop.wait(self.interval_s)


def poll_until_terminal(call_ids: list[str], timeout_s: int) -> dict:
    deadline = time.time() + timeout_s
    terminal = {}
    db = SessionLocal()
    try:
        while time.time() < deadline and len(terminal) < len(call_ids):
            remaining = [cid for cid in call_ids if cid not in terminal]
            rows = db.query(Call.id, Call.status).filter(Call.id.in_(remaining)).all()
            for cid, status in rows:
                if status in (CallStatus.processed, CallStatus.failed):
                    terminal[cid] = status
            db.expire_all()
            if len(terminal) < len(call_ids):
                time.sleep(2)
    finally:
        db.close()
    return terminal


def report(call_ids: list[str], run_id: str, samples: list, stage: str):
    db = SessionLocal()
    try:
        jobs = db.query(ProcessingJob).filter(ProcessingJob.call_id.in_(call_ids)).all()
        by_stage = defaultdict(list)
        failures = defaultdict(list)
        for j in jobs:
            if j.started_at and j.completed_at:
                by_stage[j.stage.value].append((j.completed_at - j.started_at).total_seconds())
            if j.status.value == "failed" and j.error_message:
                failures[j.stage.value].append(j.error_message[:200])

        print("\n=== Per-stage latency (seconds) ===")
        for stage_name, durations in sorted(by_stage.items()):
            durations.sort()
            p50 = statistics.median(durations)
            p95 = durations[max(0, int(len(durations) * 0.95) - 1)]
            print(f"  {stage_name:20s} n={len(durations):4d}  p50={p50:6.2f}s  p95={p95:6.2f}s  max={max(durations):6.2f}s")

        if failures:
            print("\n=== Failures by stage ===")
            for stage_name, msgs in failures.items():
                print(f"  {stage_name}: {len(msgs)} failures, e.g. {msgs[0]}")

        calls = db.query(Call).filter(Call.id.in_(call_ids)).all()
        wall_times = sorted(
            (c.processed_at - c.uploaded_at).total_seconds()
            for c in calls if c.processed_at and c.uploaded_at
        )
        succeeded = sum(1 for c in calls if c.status == CallStatus.processed)
        failed = sum(1 for c in calls if c.status == CallStatus.failed)
        timed_out = len(call_ids) - succeeded - failed

        print("\n=== Summary ===")
        print(f"  seeded={len(call_ids)}  succeeded={succeeded}  failed={failed}  timed_out(still processing)={timed_out}")
        if wall_times:
            print(f"  end-to-end wall time: p50={statistics.median(wall_times):.1f}s  "
                  f"p95={wall_times[max(0, int(len(wall_times) * 0.95) - 1)]:.1f}s  max={max(wall_times):.1f}s")

        if stage == "real":
            total_audio_s = sum(c.duration_seconds or 0 for c in calls)
            print(f"  total transcribed audio: {total_audio_s}s (Deepgram cost proxy)")
            print("  NOTE: OpenAI token usage is not currently logged per-call"
                  " (OpenAIProvider.generate_json discards response.usage) --"
                  " no LLM cost figure available without that follow-up change.")

        if samples:
            print("\n=== Queue depth / DB connections over time (sampled) ===")
            t0 = samples[0][0]
            stride = max(1, len(samples) // 20)
            for ts, depths, pg_conns in samples[::stride]:
                depth_str = " ".join(f"{q}={v}" for q, v in depths.items()) or "n/a"
                print(f"  t={ts - t0:6.1f}s  {depth_str}  pg_conns={pg_conns}")

        print(f"\nRun id: {run_id}  (use --cleanup {run_id} to remove seeded data)")
    finally:
        db.close()


def cleanup(run_id: str):
    db = SessionLocal()
    try:
        tag = f"loadtest-{run_id}"
        agents = db.query(Agent).filter(Agent.external_agent_id == tag).all()
        if not agents:
            print(f"No load-test data found for run_id={run_id}")
            return
        call_ids = []
        for agent in agents:
            call_ids.extend(c.id for c in db.query(Call).filter(Call.agent_id == agent.id).all())

        print(f"Cleaning up {len(call_ids)} call(s) from run {run_id}...")

        qa_ids = [r.id for r in db.query(QAEvaluation.id).filter(QAEvaluation.call_id.in_(call_ids)).all()]
        if qa_ids:
            db.query(QACriteriaScore).filter(QACriteriaScore.qa_evaluation_id.in_(qa_ids)).delete(synchronize_session=False)
        db.query(QAEvaluation).filter(QAEvaluation.call_id.in_(call_ids)).delete(synchronize_session=False)

        transcript_ids = [r.id for r in db.query(Transcript.id).filter(Transcript.call_id.in_(call_ids)).all()]
        if transcript_ids:
            db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id.in_(transcript_ids)).delete(synchronize_session=False)
        db.query(Transcript).filter(Transcript.call_id.in_(call_ids)).delete(synchronize_session=False)

        review_ids = [r.id for r in db.query(ManualQAReview.id).filter(ManualQAReview.call_id.in_(call_ids)).all()]
        if review_ids:
            db.query(ManualQACriteriaScore).filter(ManualQACriteriaScore.review_id.in_(review_ids)).delete(synchronize_session=False)
        db.query(ManualQAReview).filter(ManualQAReview.call_id.in_(call_ids)).delete(synchronize_session=False)

        for model in (
            ComplianceViolation, SentimentAnalysis, EmotionAnalysis,
            ConversationAnalytics, CustomerAnalytics, TimelineEvent,
            AIObservation, Recommendation, CallExtraction, CallClassification,
            CallLabel, PauseEvent, CallInsight, ProcessingJob,
        ):
            db.query(model).filter(model.call_id.in_(call_ids)).delete(synchronize_session=False)

        db.query(Call).filter(Call.id.in_(call_ids)).delete(synchronize_session=False)
        for agent in agents:
            db.delete(agent)
        db.commit()

        for call_id in call_ids:
            try:
                minio_client.delete_call_objects(call_id)
            except Exception as e:
                print(f"  warning: failed to delete MinIO objects for {call_id}: {e}")

        print(f"Cleaned up {len(call_ids)} call(s) and {len(agents)} agent(s).")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--stage", choices=["mock", "real"])
    parser.add_argument("--n", type=int, default=None)
    parser.add_argument("--concurrency", type=int, default=None)
    parser.add_argument("--base-url", default="http://localhost:8000/api/v1")
    parser.add_argument("--seed-mode", choices=["http", "direct"], default="http",
                         help="'http' POSTs to POST /calls (real path, but see the wedge-under-load "
                              "caveat in this file's docstring); 'direct' bypasses it to isolate "
                              "Celery/Postgres/MinIO capacity.")
    parser.add_argument("--timeout", type=int, default=None, help="Seconds to wait for all calls to reach a terminal state")
    parser.add_argument("--audio-duration", type=int, default=None,
                         help="Seconds of test audio to synthesize per call. Default: random 300-600s "
                              "(5-10 min, matching realistic call lengths).")
    parser.add_argument("--cleanup", metavar="RUN_ID", help="Delete all load-test data tagged with this run id, then exit")
    args = parser.parse_args()

    if args.cleanup:
        cleanup(args.cleanup)
        return

    if not args.stage:
        parser.error("--stage {mock,real} is required (or use --cleanup RUN_ID)")

    # Real audio uploads/transcribes/prompts scale with duration -- 5-10 min
    # calls need much more headroom than the ~15s clips this defaulted to
    # before.
    defaults = {"mock": (500, 40, 900), "real": (15, 3, 1800)}
    default_n, default_concurrency, default_timeout = defaults[args.stage]
    n = args.n or default_n
    concurrency = args.concurrency or default_concurrency
    timeout_s = args.timeout or default_timeout

    print("Synthesizing test audio...")
    audio_bytes, actual_duration_s = make_test_audio(args.audio_duration)

    if args.stage == "real":
        print("=" * 70)
        print("WARNING: --stage real makes live calls to Deepgram and OpenAI")
        print("using the API keys configured in .env. This spends real money.")
        print(f"About to seed {n} calls at concurrency {concurrency}, each with "
              f"{actual_duration_s:.0f}s ({actual_duration_s / 60:.1f} min) of audio "
              f"({n * actual_duration_s / 60:.1f} min total transcribed).")
        print("=" * 70)
        confirmation = input('Type "I understand this spends real money" to proceed: ')
        if confirmation.strip() != "I understand this spends real money":
            print("Aborted.")
            return

    run_id = uuid.uuid4().hex[:8]
    print(f"Run id: {run_id}  (audio: {actual_duration_s:.0f}s per call)")

    print(f"Seeding {n} calls at concurrency {concurrency} (seed-mode={args.seed_mode})...")
    sampler = Sampler()
    sampler.start()
    t0 = time.time()
    if args.seed_mode == "direct":
        call_ids, seed_errors = asyncio.run(seed_direct(run_id, n, concurrency, audio_bytes))
    else:
        call_ids, seed_errors = asyncio.run(seed(run_id, n, concurrency, args.base_url, audio_bytes))
    seed_elapsed = time.time() - t0
    print(f"Seeded {len(call_ids)}/{n} calls in {seed_elapsed:.1f}s ({len(seed_errors)} upload errors)")
    if seed_errors:
        print(f"  first error: {seed_errors[0]}")

    if not call_ids:
        sampler.stop()
        print("No calls were seeded successfully -- aborting.")
        return

    print(f"Waiting for pipeline to finish (timeout {timeout_s}s)...")
    poll_until_terminal(call_ids, timeout_s)
    sampler.stop()

    report(call_ids, run_id, sampler.samples, args.stage)


if __name__ == "__main__":
    main()
