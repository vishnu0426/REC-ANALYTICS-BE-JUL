import re
from urllib.parse import unquote

from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Call, CallStatus
from app.storage import minio_client
from app.tasks.call_ingest import claim_for_enqueue, get_or_create_call_from_key
from app.tasks.pipeline import run_pipeline, backfill_insights, backfill_playback

router = APIRouter(prefix="/internal", tags=["Internal"])

# This app's own upload endpoint (app/api/calls.py::upload_call) — a Call
# row always exists before the object lands, since the endpoint creates the
# DB row first, then writes to MinIO.
_CALLS_PATTERN = re.compile(r"^calls/([0-9a-fA-F-]{36})/")


@router.post("/minio-webhook", include_in_schema=False)
async def minio_webhook(request: Request, db: Session = Depends(get_db)):
    """
    MinIO calls this the instant an object finishes uploading to the
    configured bucket. This is the real "whenever data lands in MinIO, the
    app reacts" trigger — independent of whether any upload API call is
    involved at all, which matters a lot for `call-records/...` (see
    app/tasks/call_ingest.py) where there is no upload API call at all.

    Note: if MinIO can't reach this backend to deliver the push notification
    (e.g. it's on a different network with no route back), nothing here ever
    fires — app/tasks/sync.py's periodic `sync_call_records` task exists as
    a poll-based fallback for exactly that case, reusing the same
    `get_or_create_call_from_key` logic as this handler.
    """
    payload = await request.json()
    processed = []
    for record in payload.get("Records", []):
        bucket = record.get("s3", {}).get("bucket", {}).get("name", "")
        if bucket != minio_client.BUCKET:
            continue

        # MinIO (like S3) URL-encodes the object key in event payloads —
        # e.g. "calls%2F{uuid}%2Foriginal.wav" — so it must be decoded
        # before either path-shaped pattern below can match it.
        key = unquote(record.get("s3", {}).get("object", {}).get("key", ""))

        call = None
        m = _CALLS_PATTERN.match(key)
        if m:
            call = db.query(Call).filter(Call.id == m.group(1)).first()
        else:
            call = get_or_create_call_from_key(db, key)

        if call and claim_for_enqueue(db, call.id):
            run_pipeline.delay(call.id)
            processed.append(call.id)
    return {"received": True, "enqueued": processed}


@router.post("/backfill-insights")
def trigger_backfill_insights(db: Session = Depends(get_db)):
    """Enqueues the CallInsight backfill for processed calls that predate
    insight persistence (see pipeline.py::backfill_insights). Safe to call
    repeatedly — calls that already have insights are skipped."""
    from app.models.models import CallInsight

    pending = (
        db.query(Call)
        .filter(Call.status == CallStatus.processed)
        .outerjoin(CallInsight, CallInsight.call_id == Call.id)
        .filter(CallInsight.id.is_(None))
        .count()
    )
    backfill_insights.delay()
    return {"enqueued": True, "calls_pending_backfill": pending}


@router.post("/backfill-playback")
def trigger_backfill_playback():
    """Enqueues the fast-playback upgrade (MP3 copy + waveform peaks) for
    calls processed before it existed. Safe to call repeatedly."""
    backfill_playback.delay()
    return {"enqueued": True}
