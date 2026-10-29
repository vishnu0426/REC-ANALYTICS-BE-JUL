"""
Maps the raw `Call.failure_reason` (exception text + traceback tail) onto a
stable, user-facing failure descriptor. The raw text stays in the DB for
engineers; the UI shows `title` / `message` / `action` and tucks the raw text
behind a "Technical details" disclosure.
"""
from typing import Optional

# (code, title, message, action, retryable) — first matching rule wins.
_RULES = [
    (("ffmpeg executable not found", "filenotfounderror"),
     "MEDIA_TOOL_MISSING", "Audio processor unavailable",
     "The audio conversion tool (ffmpeg) could not be found on the processing server.",
     "Ask your administrator to install ffmpeg or set FFMPEG_PATH, then retry.", True),
    (("could not decode this audio", "mp3 encode failed", "audiodecodeerror"),
     "AUDIO_UNREADABLE", "Recording could not be read",
     "The audio file is corrupt or uses a format that could not be converted.",
     "Re-export the recording from the source system and upload it again.", False),
    (("no speech detected",),
     "NO_SPEECH", "No speech detected",
     "The recording contains no recognisable speech, so there is nothing to analyse.",
     "Check that the recording is not silent or truncated.", False),
    (("deepgram", "speech-to-text"),
     "TRANSCRIPTION_FAILED", "Transcription failed",
     "The speech-to-text service did not return a transcript.",
     "Retry. If it keeps failing, check the STT provider credentials.", True),
    (("openai", "ollama", "rate limit", "llm"),
     "ANALYSIS_FAILED", "AI analysis failed",
     "The AI analysis service did not respond successfully.",
     "Retry in a few minutes.", True),
    (("minio", "s3error", "connection refused", "max retries exceeded", "timed out"),
     "STORAGE_UNREACHABLE", "Storage unreachable",
     "The recording could not be fetched from object storage.",
     "Retry once storage connectivity is restored.", True),
    (("stuck in", "automatic recovery"),
     "PROCESSING_STALLED", "Processing stalled",
     "The worker stopped responding repeatedly while processing this call.",
     "Retry. If it recurs, contact support with the reference ID.", True),
]


def classify_failure(reason: Optional[str]) -> Optional[dict]:
    if not reason:
        return None
    lowered = reason.lower()
    for needles, code, title, message, action, retryable in _RULES:
        if any(n in lowered for n in needles):
            return {"code": code, "title": title, "message": message, "action": action, "retryable": retryable}
    return {
        "code": "UNEXPECTED_ERROR",
        "title": "Processing failed",
        "message": "Something went wrong while processing this recording.",
        "action": "Retry. If it keeps failing, contact support with the reference ID.",
        "retryable": True,
    }
