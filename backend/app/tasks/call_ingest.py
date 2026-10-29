"""
Shared logic for recognizing and ingesting call-records/ files — real
PBX/FreeSWITCH recordings written directly to MinIO with no app involvement,
as opposed to `calls/{call_id}/...` which this app's own upload endpoint
creates. Used by both the MinIO webhook (app/api/internal.py, push-based)
and the periodic sync task (app/tasks/sync.py, poll-based fallback for when
MinIO can't reach the backend to push notifications at all).

Confirmed live structure of the `call-records/` prefix in the shared
`workspace-1` bucket:
    call-records/{YYYY}/{MM}/{DD}/{external-call-uuid}-{ts}-call_..._....wav
"""
import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.models import Call, CallStatus

CALL_RECORDS_PATTERN = re.compile(r"^call-records/(\d{4})/(\d{2})/(\d{2})/(.+)$")
EXTERNAL_ID_PATTERN = re.compile(
    r"^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-"
)


def extract_external_call_id(filename: str) -> str | None:
    match = EXTERNAL_ID_PATTERN.match(filename)
    return match.group(1) if match else None


def get_or_create_call_from_key(db: Session, key: str) -> Call | None:
    """
    Returns the Call row for a `call-records/...` object key, creating one
    if it doesn't exist yet (the external UUID embedded in the filename is
    reused directly as our `Call.id`, rather than maintaining a separate
    external-id mapping column). Returns None if the key isn't a
    call-records path or its filename doesn't match the known naming
    convention — callers should skip rather than guess at an identity.
    """
    match = CALL_RECORDS_PATTERN.match(key)
    if not match:
        return None
    year, month, day, filename = match.groups()
    external_id = extract_external_call_id(filename)
    if not external_id:
        return None

    call = db.query(Call).filter(Call.id == external_id).first()
    if not call:
        call = Call(
            id=external_id,
            original_filename=filename,
            storage_path=key,
            status=CallStatus.uploaded,
            call_date=datetime(int(year), int(month), int(day)),
        )
        db.add(call)
        db.commit()
    return call


def claim_for_enqueue(db: Session, call_id: str) -> bool:
    """
    Atomically transitions a call from `uploaded` to `validating` and
    returns whether *this* caller won that transition.

    Both the MinIO webhook (push) and sync_call_records (poll, every 1s)
    independently look for calls still sitting at `uploaded` and enqueue
    `run_pipeline.delay()` for them. Status doesn't flip to `processing`
    until a worker actually starts the task -- so while a task sits queued
    (worker busy, backlog, etc.), every subsequent poll tick or a webhook
    retry would see the same still-`uploaded` call and enqueue it again.
    run_pipeline's own atomic claim (uploaded/validating -> processing)
    already makes those duplicates harmless no-ops, but does nothing to stop
    them from being created in the first place -- a call stuck in a 60s
    backlog gets ~60 redundant Celery messages at a 1s poll interval. This
    claims the call the moment it's chosen for enqueue, not when the task
    finally runs, so only the first caller (webhook or a given poll tick)
    ever actually calls .delay() for it.
    """
    claimed = db.query(Call).filter(
        Call.id == call_id, Call.status == CallStatus.uploaded
    ).update({"status": CallStatus.validating}, synchronize_session=False)
    db.commit()
    return bool(claimed)
