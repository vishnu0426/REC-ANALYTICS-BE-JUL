"""
MinIO storage layer.

Two distinct MinIO endpoints are in play, and mixing them up is the #1 way
this integration breaks in docker-compose setups:

  - `minio_endpoint`        ("minio:9000") — used by the BACKEND CONTAINER to
                              talk to MinIO over the docker network.
  - `minio_public_endpoint` ("localhost:9000") — baked into presigned URLs,
                              which the USER'S BROWSER must be able to resolve
                              directly (the browser is not on the docker network).

Audio never round-trips through the FastAPI process for playback — the browser
streams directly from MinIO via a short-lived presigned URL. The backend's job
is only to (a) accept the upload and put it in MinIO, and (b) mint that URL.
"""
from datetime import timedelta
from io import BytesIO

from minio import Minio
from minio.error import S3Error

from app.core.config import get_settings

settings = get_settings()

# Client used for server-side operations (put_object, bucket admin) — talks to
# MinIO over the internal docker network.
_internal_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure,
)

# Client used ONLY to construct presigned URLs — must use the endpoint the
# browser can actually reach, or the generated URL will 404/timeout for the user.
_public_client = Minio(
    settings.minio_public_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure,
)

BUCKET = settings.minio_bucket


def ensure_bucket():
    if not _internal_client.bucket_exists(BUCKET):
        _internal_client.make_bucket(BUCKET)


def object_key_for_call(call_id: str, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    return f"calls/{call_id}/original.{ext}"


def object_key_for_playback(call_id: str) -> str:
    """
    The original upload is kept byte-for-byte as-is (compliance/chain-of-
    custody — some source systems, e.g. signed PBX recordings, should never
    be silently re-encoded away). Browsers can't necessarily decode whatever
    codec that original used (e.g. G.729, common from PBX/SIP sources), so a
    separately encoded, browser-playable copy is stored alongside it and
    served for playback instead — see pipeline.py::_stage_transcribe.
    """
    return f"calls/{call_id}/playback.mp3"


def object_key_for_playback_wav(call_id: str) -> str:
    """Legacy playback copy: calls processed before the MP3 switch have a
    (much larger) normalized WAV under this key instead."""
    return f"calls/{call_id}/playback.wav"


def upload_playback_audio(call_id: str, mp3_bytes: bytes) -> str:
    key = object_key_for_playback(call_id)
    _internal_client.put_object(
        BUCKET, key, data=BytesIO(mp3_bytes), length=len(mp3_bytes), content_type="audio/mpeg",
    )
    return key


def upload_audio(call_id: str, filename: str, file_bytes: bytes, content_type: str) -> str:
    """
    Stores the raw upload in MinIO under a per-call key and returns that key.
    This is the write side of "whenever data lands in MinIO the app picks it
    up": MinIO is itself configured (see docker-compose minio-init service)
    to fire a webhook to /internal/minio-webhook the instant this PUT completes,
    which is what actually enqueues the processing pipeline — not this function.
    This function's only job is the storage write.
    """
    ensure_bucket()
    key = object_key_for_call(call_id, filename)
    _internal_client.put_object(
        BUCKET,
        key,
        data=BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type or "application/octet-stream",
    )
    return key


def get_presigned_audio_url(object_key: str, expires_minutes: int = 30) -> str:
    """
    Mints a short-lived URL the browser's <audio>/wavesurfer element streams
    directly from MinIO. Expiry is deliberately short — this URL should be
    re-requested per viewing session, not cached long-term by the frontend.
    """
    scheme = "https" if settings.minio_secure else "http"
    url = _public_client.presigned_get_object(
        BUCKET, object_key, expires=timedelta(minutes=expires_minutes)
    )
    # minio-py returns a full URL already including scheme+host based on the
    # client's configured endpoint, so no further string surgery is needed here.
    return url


def download_audio_bytes(object_key: str) -> bytes:
    """Used server-side by pipeline workers that need the raw audio (e.g. the
    Audio/Diarization/Speech workers), fetched via the internal client."""
    response = _internal_client.get_object(BUCKET, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def object_exists(object_key: str) -> bool:
    try:
        _internal_client.stat_object(BUCKET, object_key)
        return True
    except S3Error:
        return False


def delete_call_objects(call_id: str) -> None:
    """Removes every object under a call's `calls/{call_id}/` prefix (original
    upload, playback mp3/wav). Used by load-test cleanup — no other code path
    deletes call audio today."""
    from minio.deleteobjects import DeleteObject

    prefix = f"calls/{call_id}/"
    objects = _internal_client.list_objects(BUCKET, prefix=prefix, recursive=True)
    to_delete = [DeleteObject(obj.object_name) for obj in objects]
    if to_delete:
        errors = list(_internal_client.remove_objects(BUCKET, to_delete))
        if errors:
            raise RuntimeError(f"Failed to delete {len(errors)} object(s) under {prefix}: {errors[0].message}")
