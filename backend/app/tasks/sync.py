"""
Poll-based fallback for picking up call-records/ recordings when MinIO's
push webhook can't reach this backend at all (e.g. the backend runs on a
different network than MinIO, with no route back for MinIO to call). Scans
only the last couple of days' date-prefixed folders — the chronological
`call-records/{YYYY}/{MM}/{DD}/` layout makes that cheap regardless of how
much history the bucket accumulates, unlike listing the whole prefix.

Registered as a Celery Beat periodic task in celery_app.py. Requires a
`celery beat` process running alongside the worker — beat only schedules,
it doesn't execute tasks itself.
"""
from datetime import datetime, timedelta

from app.tasks.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.models import Call, CallStatus, ProcessingJob
from app.storage import minio_client
from app.tasks.call_ingest import claim_for_enqueue, get_or_create_call_from_key
from app.tasks.pipeline import run_pipeline

LOOKBACK_DAYS = 2
# Matches reap_stale_processing's own 5-minute beat interval, so a stuck call
# is caught on the very next cycle after going stale rather than waiting up
# to 4 extra cycles. Real single-stage durations observed in this repo's own
# load testing stay well under a minute even for 5-10 min audio (Deepgram
# processes far faster than real-time), so this shouldn't false-positive on
# a merely-slow-but-legitimate run.
STALE_PROCESSING_MINUTES = 5
MAX_STALE_RETRIES = 3


def _recent_date_prefixes(days_back: int = LOOKBACK_DAYS) -> list[str]:
    today = datetime.utcnow().date()
    return [
        f"call-records/{(today - timedelta(days=i)):%Y/%m/%d}/"
        for i in range(days_back)
    ]


@celery_app.task(name="app.tasks.sync.sync_call_records")
def sync_call_records():
    db = SessionLocal()
    enqueued = []
    try:
        for prefix in _recent_date_prefixes():
            for obj in minio_client._internal_client.list_objects(minio_client.BUCKET, prefix=prefix, recursive=True):
                call = get_or_create_call_from_key(db, obj.object_name)
                if call and claim_for_enqueue(db, call.id):
                    run_pipeline.delay(call.id)
                    enqueued.append(call.id)
        return enqueued
    finally:
        db.close()


@celery_app.task(name="app.tasks.sync.reap_stale_processing")
def reap_stale_processing():
    """
    Recovers calls stuck at `processing`/`validating` because the worker
    handling them died mid-task (SIGKILL, OOM, deploy, host restart) rather
    than raising a catchable exception -- run_pipeline's `except` block never
    runs in that case, so nothing else ever moves the call off that status.
    Confirmed live: two real calls sat stuck in `processing` for 2+ days
    after a worker restart, because Celery's own acks_late/
    task_reject_on_worker_lost redelivery depends on the broker actually
    still holding the unacked message -- if Redis itself restarts or the
    message's visibility window is exceeded, the message is just gone and
    nothing ever retries it. Since run_pipeline's atomic claim (added to fix
    duplicate reprocessing) only accepts uploaded/validating, a call stuck at
    `processing` could otherwise never be legitimately re-claimed at all.

    Re-enqueues a truly stale call directly (claims it to `validating`, the
    same intermediate state the webhook/sync_call_records use, then calls
    run_pipeline.delay() itself) rather than resetting it to `uploaded` and
    hoping sync_call_records rediscovers it -- that poller only scans the
    last LOOKBACK_DAYS of MinIO date-prefixes, so an old stuck call would
    otherwise sit at `uploaded` forever, unreachable by anything. Capped at
    MAX_STALE_RETRIES via call_metadata so a call that reliably crashes the
    worker (e.g. corrupt audio hanging ffmpeg) doesn't loop forever -- it's
    marked `failed` with a clear reason once the cap is hit.
    """
    db = SessionLocal()
    recovered, gave_up = [], []
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=STALE_PROCESSING_MINUTES)
        stuck = db.query(Call).filter(Call.status.in_([CallStatus.processing, CallStatus.validating])).all()
        for call in stuck:
            latest_job = (
                db.query(ProcessingJob)
                .filter(ProcessingJob.call_id == call.id)
                .order_by(ProcessingJob.started_at.desc())
                .first()
            )
            last_activity = latest_job.started_at if latest_job and latest_job.started_at else call.uploaded_at
            if not last_activity or last_activity > cutoff:
                continue  # still plausibly in flight

            retry_count = (call.call_metadata or {}).get("stale_reap_count", 0)
            if retry_count >= MAX_STALE_RETRIES:
                call.status = CallStatus.failed
                call.failure_reason = (
                    f"Stuck in '{call.status.value}' with no activity for over "
                    f"{STALE_PROCESSING_MINUTES} minutes, after {retry_count} automatic recovery "
                    "attempts (worker likely crashed mid-task each time) -- giving up automatically."
                )
                gave_up.append(call.id)
            else:
                # Re-enqueue directly rather than resetting to `uploaded` and
                # hoping something rediscovers it: sync_call_records only
                # scans the last LOOKBACK_DAYS of MinIO date-prefixes, so an
                # `uploaded` call whose recording is older than that (exactly
                # what stale/crashed calls tend to be, by definition -- they
                # can sit for days before this reaper runs) would otherwise
                # never be picked up again by anything. Confirmed live: two
                # real calls sat at `uploaded` for 3+ days after being reset
                # this way before this fix, because their call-records/
                # object fell outside the 2-day scan window.
                call.status = CallStatus.validating
                # Clear any stale failure_reason from a prior attempt --
                # otherwise a call about to be legitimately retried can
                # confusingly still show an old traceback in the UI, as if it
                # had already failed again.
                call.failure_reason = None
                call.call_metadata = {**(call.call_metadata or {}), "stale_reap_count": retry_count + 1}
                db.commit()
                run_pipeline.delay(call.id)
                recovered.append(call.id)
                continue
        db.commit()
        return {"recovered": recovered, "gave_up": gave_up}
    finally:
        db.close()
