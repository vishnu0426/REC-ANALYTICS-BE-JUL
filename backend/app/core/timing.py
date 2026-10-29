from datetime import datetime
from typing import Optional


def processing_duration(call) -> Optional[float]:
    """Seconds the pipeline actually spent on a call.

    Measured from `call_metadata["processing_started_at"]` (stamped when a
    worker claims the call) rather than `uploaded_at`: the latter also counts
    time sitting in the queue, stuck/reaped runs and manual retries days
    later, which is how rows ended up showing 60,000+ seconds.
    """
    if not call.processed_at:
        return None
    started = None
    raw = (call.call_metadata or {}).get("processing_started_at")
    if raw:
        try:
            started = datetime.fromisoformat(raw)
        except ValueError:
            started = None
    started = started or call.uploaded_at
    if not started:
        return None
    return round(max(0.0, (call.processed_at - started).total_seconds()), 1)
