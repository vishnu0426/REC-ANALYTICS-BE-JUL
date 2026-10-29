"""
Pipeline orchestration.

This scaffold runs the stages as ordered steps inside one Celery task
(`run_pipeline`) rather than a full `chain()`/`chord()` of independently
queued tasks, to keep the reference implementation easy to read end to end.
`07-worker-topology.md` describes the production shape: each stage below
becomes its own task on the `gpu-heavy` or `cpu-io` queue, chained with
`acks_late` + per-stage retry, with QA/Compliance/Sentiment/Emotion fanned
out in parallel via `chord()`. The stage functions here are already split
out 1:1 with that design specifically so promoting them to standalone
`@celery_app.task` functions later is a mechanical change, not a rewrite.
"""
import re
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from app.tasks.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.models import (
    Call, CallStatus, ProcessingJob, JobStage, JobStatus,
    Transcript, TranscriptSegment, QAEvaluation, QACriteriaScore,
    ComplianceViolation, SentimentAnalysis, EmotionAnalysis,
    ConversationAnalytics, CustomerAnalytics, TimelineEvent,
    AIObservation, Recommendation,
    CallExtraction, CallClassification, CallLabel, PauseEvent,
    CallInsight,
)
from app.storage import minio_client
from app.tasks.providers import get_stt_provider, get_llm_provider

QA_CRITERIA = [
    "greeting", "identity_verification", "listening", "empathy",
    "communication", "professionalism", "knowledge", "resolution", "closing",
]

LABEL_VOCAB = [
    "urgent", "escalation_required", "follow_up_needed",
    "satisfaction_survey", "training_opportunity", "upsell_opportunity",
]

DEFAULT_COMPLIANCE_RULES = [
    {"code": "GREETING_MISSING", "category": "greeting",
     "rule": "Agent must greet the customer and state their name near the start of the call."},
    {"code": "IDENTITY_VERIFICATION_MISSING", "category": "identity",
     "rule": "Agent must verify the customer's identity (e.g. name, account email, or last digits of a card) before discussing account details."},
    {"code": "ABUSIVE_LANGUAGE", "category": "language",
     "rule": "Neither party used abusive, threatening, or discriminatory language."},
    {"code": "CLOSING_MISSING", "category": "closing",
     "rule": "Agent must close the call professionally (e.g. asking if there's anything else, thanking the customer)."},
]

# Below this many total spoken words across the whole call, there is not
# enough real content to ground an LLM analysis — treat it the same as no
# speech at all rather than risk a fabricated-but-plausible-looking result.
MIN_WORDS_FOR_ANALYSIS = 5


class NoSpeechDetected(Exception):
    pass


def _has_meaningful_speech(segments: list[dict]) -> bool:
    total_words = sum(len(s["text"].split()) for s in segments)
    return total_words >= MIN_WORDS_FOR_ANALYSIS


def _touch_job(db, call_id: str, stage: JobStage, status: JobStatus, error: str = None):
    job = db.query(ProcessingJob).filter(
        ProcessingJob.call_id == call_id, ProcessingJob.stage == stage
    ).first()
    if not job:
        job = ProcessingJob(call_id=call_id, stage=stage, attempt_count=0)
        db.add(job)
    job.status = status
    job.error_message = error
    if status == JobStatus.running:
        job.started_at = datetime.utcnow()
        job.attempt_count += 1
    if status in (JobStatus.succeeded, JobStatus.failed):
        job.completed_at = datetime.utcnow()
    db.commit()


def _clear_previous_results(db, call_id: str):
    """
    Makes a genuine (re)run of the pipeline idempotent — e.g. a call
    deliberately reset to `uploaded` and resubmitted. The race that used to
    let *duplicate* concurrent runs reach here (a webhook or the sync poller
    firing again before an already-enqueued run had even started) is now
    prevented upstream by run_pipeline's atomic status claim, so this no
    longer needs to defend against two runs clearing/rewriting at once —
    only one run for a given call is ever in flight at a time.
    """
    qa_ids = [row.id for row in db.query(QAEvaluation.id).filter(QAEvaluation.call_id == call_id).all()]
    if qa_ids:
        db.query(QACriteriaScore).filter(QACriteriaScore.qa_evaluation_id.in_(qa_ids)).delete(synchronize_session=False)
    db.query(QAEvaluation).filter(QAEvaluation.call_id == call_id).delete(synchronize_session=False)

    transcript_ids = [row.id for row in db.query(Transcript.id).filter(Transcript.call_id == call_id).all()]
    if transcript_ids:
        db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id.in_(transcript_ids)).delete(synchronize_session=False)
    db.query(Transcript).filter(Transcript.call_id == call_id).delete(synchronize_session=False)

    for model in (
        ComplianceViolation, SentimentAnalysis, EmotionAnalysis,
        ConversationAnalytics, CustomerAnalytics, TimelineEvent,
        AIObservation, Recommendation, CallExtraction, CallClassification,
        CallLabel, PauseEvent, CallInsight, ProcessingJob,
    ):
        db.query(model).filter(model.call_id == call_id).delete(synchronize_session=False)

    db.commit()


@celery_app.task(name="app.tasks.pipeline.run_pipeline", bind=True, max_retries=3)
def run_pipeline(self, call_id: str):
    db = SessionLocal()
    try:
        # Three independent things can enqueue this task for the same
        # call_id (the upload endpoint, the MinIO webhook, and the 1s-interval
        # sync_call_records poller) — all of them can see status=uploaded and
        # fire before the *first* enqueued task actually starts, since status
        # only flips once a run begins, not once it's queued. The webhook and
        # sync_call_records now atomically claim uploaded->validating the
        # moment they enqueue (see call_ingest.claim_for_enqueue), which stops
        # most duplicate enqueues before they happen; the upload endpoint's
        # direct .delay() still leaves a call at `uploaded` until this task
        # starts, so both statuses are accepted here. An atomic conditional
        # UPDATE (not a read-then-branch, which still races) means only
        # whichever invocation actually wins the transition proceeds; every
        # duplicate sees zero rows affected and exits immediately instead of
        # wiping and reprocessing an already-processing/processed call.
        claimed = db.query(Call).filter(
            Call.id == call_id, Call.status.in_([CallStatus.uploaded, CallStatus.validating]),
        ).update({"status": CallStatus.processing}, synchronize_session=False)
        db.commit()
        if not claimed:
            return

        call = db.query(Call).filter(Call.id == call_id).first()
        if not call:
            return
        # Real pipeline start (excludes queue wait / earlier stuck runs) — read
        # by app.core.timing.processing_duration for the "Processing Time" column.
        call.call_metadata = {**(call.call_metadata or {}), "processing_started_at": datetime.utcnow().isoformat()}
        _clear_previous_results(db, call_id)
        db.commit()

        segments = _stage_transcribe(db, call)
        if not _has_meaningful_speech(segments):
            # Do not hand an empty/near-empty transcript to the LLM: without
            # real content to ground it, a model asked for a fixed JSON shape
            # (customer name, QA scores, resolution summary, ...) will often
            # fabricate a plausible-looking answer rather than say "no data"
            # unless explicitly told to. Refusing to analyze is the only
            # guarantee against that — a well-worded prompt is a probabilistic
            # mitigation, not a guarantee.
            raise NoSpeechDetected(
                "No speech detected in this recording — nothing to transcribe or analyze."
            )
        analysis = _stage_llm_analysis(db, call, segments)
        _stage_qa(db, call, segments, analysis)
        _stage_compliance(db, call, segments, analysis)
        _stage_extraction_labeling(db, call, segments, analysis)
        _stage_insights(db, call, analysis)
        _stage_sentiment_emotion(db, call, analysis)
        _stage_analytics(db, call, segments, analysis)
        _stage_timeline_and_recommendations(db, call, analysis)

        call.status = CallStatus.processed
        call.processed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        db.rollback()
        call = db.query(Call).filter(Call.id == call_id).first()
        if call:
            call.status = CallStatus.failed
            # Known, self-explanatory failures (e.g. no speech detected) get a
            # clean user-facing message; everything else keeps the traceback
            # tail for debugging, since it's genuinely unexpected.
            if isinstance(exc, NoSpeechDetected):
                call.failure_reason = str(exc)
            else:
                call.failure_reason = f"{exc}\n{traceback.format_exc()[-2000:]}"
            # A stage function (_stage_transcribe et al.) that raises never
            # gets to call _touch_job(..., succeeded) for itself, so whatever
            # stage was in flight is otherwise left showing JobStatus.running
            # forever even though the call correctly moved to `failed` here
            # -- confirmed live: a call's /jobs view can show a stage stuck
            # "running" indefinitely despite the call itself being failed.
            db.query(ProcessingJob).filter(
                ProcessingJob.call_id == call_id, ProcessingJob.status == JobStatus.running,
            ).update({"status": JobStatus.failed, "completed_at": datetime.utcnow()}, synchronize_session=False)
            db.commit()
        raise
    finally:
        db.close()


class AudioDecodeError(Exception):
    pass


def _ffmpeg_bin() -> str:
    """Resolve ffmpeg once per call: FFMPEG_PATH setting, else PATH. A bare
    FileNotFoundError ([WinError 2]) from subprocess tells nobody what is
    missing, so fail with an explicit message instead."""
    import shutil
    from app.core.config import get_settings

    configured = get_settings().ffmpeg_path
    found = configured if configured and shutil.which(configured) else shutil.which("ffmpeg")
    if not found:
        # Last resort: the static binary bundled by the imageio-ffmpeg wheel
        # (requirements.txt), so a plain `pip install` is enough on any OS.
        try:
            import imageio_ffmpeg
            found = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            found = None
    if not found:
        raise AudioDecodeError(
            "ffmpeg executable not found on this worker. Install ffmpeg and add it to PATH, "
            "or set FFMPEG_PATH, then restart the worker."
        )
    return found


def _normalize_audio(audio_bytes: bytes) -> bytes:
    """
    Transcodes whatever container/codec the source system used into plain
    16kHz mono PCM WAV via ffmpeg, before handing audio to any STT provider.

    This exists because real PBX/SIP recording systems (this pipeline's
    primary intended source, not an edge case) commonly use codecs like
    G.729 for bandwidth reasons, sometimes wrapped in vendor-specific WAV
    variants with extra non-standard chunks. Deepgram/Google's WAV parsers
    and Python's own `wave` module only handle a narrow set of formats
    directly; ffmpeg's demuxer/decoder library is far more complete and
    normalizing once here means no STT provider has to special-case source
    codecs. Runs in well under a second even for a multi-minute call.
    """
    import subprocess

    proc = subprocess.run(
        [_ffmpeg_bin(), "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-f", "wav", "pipe:1"],
        input=audio_bytes, capture_output=True, timeout=120,
    )
    if proc.returncode != 0 or not proc.stdout:
        stderr_tail = proc.stderr.decode(errors="replace")[-500:]
        raise AudioDecodeError(f"Could not decode this audio file: {stderr_tail}")
    return proc.stdout


def _to_mp3(wav_bytes: bytes) -> bytes:
    """Playback copy encode: 64kbps mono MP3 is ~4x smaller than the 16kHz
    PCM WAV the STT provider needs, which is the difference between the
    player buffering ~5MB vs ~22MB for a 10-minute call."""
    import subprocess

    proc = subprocess.run(
        [_ffmpeg_bin(), "-i", "pipe:0", "-ac", "1", "-b:a", "64k", "-f", "mp3", "pipe:1"],
        input=wav_bytes, capture_output=True, timeout=120,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise AudioDecodeError(f"MP3 encode failed: {proc.stderr.decode(errors='replace')[-300:]}")
    return proc.stdout


def compute_waveform_peaks(wav_bytes: bytes, buckets: int = 600) -> list[float]:
    """Downsamples 16-bit mono PCM WAV into ~600 normalized peak values.
    Served to the frontend so wavesurfer can draw the waveform instantly
    instead of downloading and decoding the entire audio file first."""
    import io
    import wave
    from array import array

    with wave.open(io.BytesIO(wav_bytes)) as w:
        samples = array("h")
        samples.frombytes(w.readframes(w.getnframes()))
    if not samples:
        return []
    step = max(1, len(samples) // buckets)
    peaks = []
    for i in range(0, len(samples), step):
        chunk = samples[i:i + step]
        peaks.append(max(abs(min(chunk)), abs(max(chunk))) / 32768)
    top = max(peaks) or 1
    return [round(p / top, 3) for p in peaks[:buckets]]


def _prepare_playback(call_id: str, wav_bytes: bytes) -> list[float]:
    minio_client.upload_playback_audio(call_id, _to_mp3(wav_bytes))
    return compute_waveform_peaks(wav_bytes)


def _stage_transcribe(db, call: Call) -> list[dict]:
    _touch_job(db, call.id, JobStage.speech, JobStatus.running)
    audio_bytes = _normalize_audio(minio_client.download_audio_bytes(call.storage_path))
    # The normalized WAV feeds the STT provider; a compact MP3 copy plus
    # precomputed waveform peaks make browser playback near-instant (the
    # untouched original is never re-encoded in place — see
    # object_key_for_playback).
    # The MP3 encode/upload and peak computation need nothing from the STT
    # result, so they run in a worker thread while the (network-bound)
    # transcription is in flight instead of adding to the critical path.
    provider = get_stt_provider()
    with ThreadPoolExecutor(max_workers=1) as pool:
        playback = pool.submit(_prepare_playback, call.id, audio_bytes)
        segments = provider.transcribe(audio_bytes, call.original_filename)
        peaks = playback.result()
    call.call_metadata = {**(call.call_metadata or {}), "waveform_peaks": peaks}
    db.commit()

    transcript = Transcript(
        call_id=call.id,
        pii_masked=True,
        full_text_masked="\n".join(f"[{s['speaker_role']}] {s['text']}" for s in segments),
    )
    db.add(transcript)
    db.flush()
    for s in segments:
        db.add(TranscriptSegment(
            transcript_id=transcript.id,
            speaker_role=s["speaker_role"],
            sequence=s["sequence"],
            start_time=s["start_time"],
            end_time=s["end_time"],
            text_masked=s["text"],
            text_unmasked=s["text"],
            stt_confidence=s["confidence"],
        ))
    call.duration_seconds = int(segments[-1]["end_time"]) if segments else 0
    call.language = "en"
    db.commit()
    _touch_job(db, call.id, JobStage.speech, JobStatus.succeeded)
    return segments


def _transcript_text(segments: list[dict]) -> str:
    return "\n".join(f"[{s['speaker_role']} @ {s['start_time']}s] {s['text']}" for s in segments)


def _stage_llm_analysis(db, call: Call, segments: list[dict]) -> dict:
    """
    Single comprehensive LLM pass producing summary/intent/topic/keywords/
    root-cause/outcome/QA/compliance/sentiment/emotion/observations/
    recommendations as one structured JSON document. Split into the
    separate LLM / QA / Compliance / Analytics worker calls described in
    07-worker-topology.md once call volume justifies the added complexity
    and parallelism of separate LLM calls per concern.
    """
    _touch_job(db, call.id, JobStage.llm, JobStatus.running)
    llm = get_llm_provider()

    system = (
        "You are a call center QA and compliance analyst. You analyze customer "
        "support call transcripts and produce structured, evidence-based JSON "
        "analysis. Every score and violation must cite the specific transcript "
        "line and timestamp that supports it. Be concise but specific."
    )

    transcript = _transcript_text(segments)

    # One giant JSON document is dominated by output-token generation time, so
    # it is produced as two independent requests run in parallel: wall time is
    # roughly the slower half instead of the sum. The merged result has the
    # exact same shape downstream stages already consume.
    summary_prompt = f"""Analyze this customer support call transcript.

TRANSCRIPT:
{transcript}

EXTRACTION RULES for customer_info:
- "phone" must capture ANY phone number spoken or read back by either party anywhere in the call (including confirmations like "your number ending in..."), normalized to digits with an optional leading +. Numbers spoken as words ("nine eight seven...") must be converted to digits.
- Same diligence for "email" and "account_id".
- Use null ONLY when the value is truly never mentioned in the transcript. Never invent a value.

Return JSON with this exact shape:
{{
  "executive_summary": str,
  "detailed_summary": str,
  "key_discussion_points": [str],
  "final_resolution": str,
  "action_items": [{{"description": str, "owner": "agent"|"supervisor"|"customer_success"}}],
  "intent": "complaint"|"inquiry"|"refund"|"billing"|"technical_support"|"cancellation"|"upgrade"|"sales",
  "main_topic": str,
  "sub_topics": [str],
  "keywords": [str],
  "root_cause": str,
  "outcome": "resolved"|"escalated"|"transferred"|"callback_required"|"unresolved",
  "customer_info": {{"name": str|null, "phone": str|null, "email": str|null, "account_id": str|null}},
  "call_reason": {{"primary": str, "secondary": str|null}},
  "resolution_summary": str,
  "follow_up": {{"required": boolean, "reason": str|null}},
  "classification": {{"category": "billing"|"technical_support"|"account_management"|"sales"|"cancellation"|"complaint"|"general_inquiry"|"other", "subcategory": str|null, "complexity": "low"|"medium"|"high"}},
  "labels": {{"urgent": boolean, "escalation_required": boolean, "satisfaction_survey": boolean, "training_opportunity": boolean, "upsell_opportunity": boolean}},
  "timeline_events": [{{"event_type": "greeting"|"verification"|"issue"|"investigation"|"solution"|"confirmation"|"closing", "start_time": number, "end_time": number, "description": str}}],
  "observations": [{{"text": str, "timestamp": number, "category": str}}],
  "recommendations": [{{"category": "immediate_action"|"coaching"|"kb_improvement"|"sop_improvement"|"follow_up", "text": str, "priority": "low"|"medium"|"high"}}],
  "customer_risk_level": "low"|"medium"|"high",
  "escalation_risk": number,
  "churn_risk": number,
  "csat_prediction": number,
  "repeat_call_probability": number
}}"""

    scoring_prompt = f"""Analyze this customer support call transcript.

TRANSCRIPT:
{transcript}

QA CRITERIA to score 0-100 each, with explanation, supporting transcript quote, timestamp, and confidence 0-1:
{", ".join(QA_CRITERIA)}

COMPLIANCE RULES to check (flag ONLY if actually violated, with timestamp and evidence quote):
{chr(10).join(f"- {r['code']}: {r['rule']}" for r in DEFAULT_COMPLIANCE_RULES)}

Return JSON with this exact shape:
{{
  "qa_scores": [{{"criterion": str, "score": number, "explanation": str, "evidence": str, "timestamp": number, "confidence": number}}],
  "qa_strengths": str,
  "qa_weaknesses": str,
  "qa_coaching_suggestions": str,
  "qa_improvement_plan": str,
  "compliance_violations": [{{"rule_code": str, "category": str, "severity": "low"|"medium"|"high"|"critical", "timestamp": number, "explanation": str, "evidence": str}}],
  "sentiment": {{"overall": "positive"|"neutral"|"negative", "beginning": str, "middle": str, "end": str, "timeline": [{{"timestamp": number, "score": number, "label": str}}]}},
  "emotion": {{"dominant_customer": str, "dominant_agent": str, "timeline": [{{"timestamp": number, "emotion": str, "confidence": number}}]}}
}}"""

    with ThreadPoolExecutor(max_workers=2) as pool:
        summary_future = pool.submit(llm.generate_json, system, summary_prompt)
        scoring_future = pool.submit(llm.generate_json, system, scoring_prompt)
        result = {**summary_future.result(), **scoring_future.result()}
    # Keep the raw LLM output on the call so a field missing from the UI can
    # be traced to "the LLM never returned it" vs "a later stage dropped it".
    call.call_metadata = {**(call.call_metadata or {}), "analysis_raw": result}
    db.commit()
    _touch_job(db, call.id, JobStage.llm, JobStatus.succeeded)
    return result


def _stage_qa(db, call: Call, segments: list[dict], analysis: dict):
    _touch_job(db, call.id, JobStage.qa, JobStatus.running)
    qa_scores = analysis.get("qa_scores", [])
    # A null score means the LLM couldn't meaningfully assess that criterion
    # (e.g. a call cut short before a "closing" ever happened) — excluded
    # from both the overall average and the persisted per-criterion rows,
    # rather than defaulting to 0, which would misleadingly read as "failed"
    # rather than "not applicable."
    scored = [s for s in qa_scores if s.get("score") is not None]
    overall = sum(s["score"] for s in scored) / len(scored) if scored else 0

    evaluation = QAEvaluation(
        call_id=call.id,
        overall_score=round(overall, 1),
        strengths=analysis.get("qa_strengths"),
        weaknesses=analysis.get("qa_weaknesses"),
        coaching_suggestions=analysis.get("qa_coaching_suggestions"),
        improvement_plan=analysis.get("qa_improvement_plan"),
    )
    db.add(evaluation)
    db.flush()
    for s in scored:
        db.add(QACriteriaScore(
            qa_evaluation_id=evaluation.id,
            criterion=s["criterion"],
            score=s["score"],
            explanation=s.get("explanation"),
            timestamp_ref=s.get("timestamp"),
            transcript_evidence=s.get("evidence"),
            confidence=s.get("confidence", 0.85),
        ))
    db.commit()
    _touch_job(db, call.id, JobStage.qa, JobStatus.succeeded)


def _stage_compliance(db, call: Call, segments: list[dict], analysis: dict):
    _touch_job(db, call.id, JobStage.compliance, JobStatus.running)
    for v in analysis.get("compliance_violations", []):
        db.add(ComplianceViolation(
            call_id=call.id,
            rule_code=v.get("rule_code", "UNKNOWN"),
            category=v.get("category", "general"),
            severity=v.get("severity", "medium"),
            timestamp_ref=v.get("timestamp"),
            explanation=v.get("explanation"),
            evidence=v.get("evidence"),
        ))
    db.commit()
    _touch_job(db, call.id, JobStage.compliance, JobStatus.succeeded)


# Digit runs with common separators, 7-15 digits total once normalized —
# short enough sequences (card last-4, dates) fall below the floor.
_PHONE_RE = re.compile(r"\+?\d(?:[\d\s().\-]{5,}\d)")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_DIGIT_WORDS = {
    "zero": "0", "oh": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
}


def _normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw)
    # 8-digit floor: 7-digit runs in real transcripts are mostly partial
    # read-backs of account numbers/codes, not dialable numbers.
    if 8 <= len(digits) <= 15:
        return ("+" if raw.lstrip().startswith("+") else "") + digits
    return None


# Digit runs whose immediate context says they are NOT a phone number —
# account IDs, OTP/verification codes, card digits, amounts. Verified against
# real transcripts where agents read all of these aloud.
_NON_PHONE_CONTEXT = re.compile(r"account|code|card|amount|transaction|order|invoice|reference", re.I)
# Deliberately narrow: "phone number", not just "phone" — agents also say
# "read the numbers on your phone" for app/verification codes.
_PHONE_CONTEXT = re.compile(
    r"(?:phone|mobile|cell|contact)\s+number|number to (?:call|reach)|call you|reach you", re.I
)


def _find_phone_in_text(text: str) -> str | None:
    """
    Deterministic safety net behind the LLM's `customer_info.phone`: a phone
    number that is verbatim in the transcript must never be lost just because
    the model left the field null. Prefers digit runs whose nearby context
    mentions a phone; skips runs labeled as account/code/card/amount. Numeric
    forms first, then digits spoken as words ("nine eight seven...").
    """
    fallback = None
    for match in _PHONE_RE.finditer(text):
        normalized = _normalize_phone(match.group())
        if not normalized:
            continue
        context = text[max(0, match.start() - 100):match.start()]
        if _PHONE_CONTEXT.search(context):
            return normalized
        if fallback is None and not _NON_PHONE_CONTEXT.search(context):
            fallback = normalized
    if fallback:
        return fallback

    run, best = [], ""
    for word in re.findall(r"[a-z]+|\S", text.lower()):
        if word in _DIGIT_WORDS:
            run.append(_DIGIT_WORDS[word])
        else:
            if len(run) > len(best):
                best = "".join(run)
            run = []
    if len(run) > len(best):
        best = "".join(run)
    return best if 7 <= len(best) <= 15 else None


def _stage_extraction_labeling(db, call: Call, segments: list[dict], analysis: dict):
    customer_info = analysis.get("customer_info", {})
    call_reason = analysis.get("call_reason", {})
    follow_up = analysis.get("follow_up", {})
    follow_up_required = bool(follow_up.get("required", False))

    # Fill only fields the LLM left empty — the LLM stays the primary source
    # since it can attribute a number to the customer; regex cannot.
    transcript_text = "\n".join(s["text"] for s in segments)
    phone = customer_info.get("phone") or _find_phone_in_text(transcript_text)
    email_match = _EMAIL_RE.search(transcript_text)
    email = customer_info.get("email") or (email_match.group() if email_match else None)

    db.add(CallExtraction(
        call_id=call.id,
        customer_name=customer_info.get("name"),
        customer_phone=phone,
        customer_email=email,
        customer_account_id=customer_info.get("account_id"),
        call_reason_primary=call_reason.get("primary"),
        call_reason_secondary=call_reason.get("secondary"),
        resolution_summary=analysis.get("resolution_summary"),
        follow_up_required=follow_up_required,
        follow_up_reason=follow_up.get("reason"),
    ))

    classification = analysis.get("classification", {})
    db.add(CallClassification(
        call_id=call.id,
        category=classification.get("category"),
        subcategory=classification.get("subcategory"),
        complexity=classification.get("complexity", "medium"),
        confidence=classification.get("confidence", 0.85),
    ))

    # `follow_up_needed` is derived from `follow_up.required` rather than
    # asked again in `labels` — asking the same yes/no question twice in one
    # JSON pass risks the LLM answering it inconsistently.
    labels = dict(analysis.get("labels", {}))
    labels["follow_up_needed"] = follow_up_required
    for label_name in LABEL_VOCAB:
        if labels.get(label_name):
            db.add(CallLabel(call_id=call.id, label=label_name, confidence=0.85))

    db.commit()


def _stage_insights(db, call: Call, analysis: dict):
    """Persists the summary/topic/keyword portion of the LLM analysis, which
    previously was computed but dropped — the org-wide analytics page (tag
    cloud, topic breakdowns) aggregates over these rows."""
    keywords = [str(k).strip().lower() for k in analysis.get("keywords", []) if str(k).strip()]
    db.add(CallInsight(
        call_id=call.id,
        main_topic=analysis.get("main_topic"),
        intent=analysis.get("intent"),
        outcome=analysis.get("outcome"),
        root_cause=analysis.get("root_cause"),
        executive_summary=analysis.get("executive_summary"),
        detailed_summary=analysis.get("detailed_summary"),
        sub_topics=analysis.get("sub_topics", []),
        keywords=keywords,
        key_discussion_points=analysis.get("key_discussion_points", []),
        action_items=analysis.get("action_items", []),
    ))
    db.commit()


def _clean_timeline(points, value_key: str):
    """LLM timelines occasionally come back malformed (missing timestamp,
    score as a string, out-of-range values). Charts render these directly,
    so drop/clamp here rather than trusting the model's shape."""
    cleaned = []
    for p in points or []:
        if not isinstance(p, dict) or not isinstance(p.get("timestamp"), (int, float)):
            continue
        p = dict(p)
        if value_key == "score":
            try:
                p["score"] = max(-1.0, min(1.0, float(p.get("score", 0))))
            except (TypeError, ValueError):
                continue
        cleaned.append(p)
    return cleaned


def _stage_sentiment_emotion(db, call: Call, analysis: dict):
    _touch_job(db, call.id, JobStage.analytics, JobStatus.running)
    sentiment = analysis.get("sentiment", {})
    db.add(SentimentAnalysis(
        call_id=call.id,
        overall_sentiment=sentiment.get("overall", "neutral"),
        beginning_sentiment=sentiment.get("beginning"),
        middle_sentiment=sentiment.get("middle"),
        end_sentiment=sentiment.get("end"),
        timeline=_clean_timeline(sentiment.get("timeline"), "score"),
    ))
    emotion = analysis.get("emotion", {})
    db.add(EmotionAnalysis(
        call_id=call.id,
        dominant_customer_emotion=emotion.get("dominant_customer"),
        dominant_agent_emotion=emotion.get("dominant_agent"),
        timeline=_clean_timeline(emotion.get("timeline"), "emotion"),
    ))
    db.commit()


def _stage_analytics(db, call: Call, segments: list[dict], analysis: dict):
    agent_time = sum(s["end_time"] - s["start_time"] for s in segments if s["speaker_role"] == "agent")
    customer_time = sum(s["end_time"] - s["start_time"] for s in segments if s["speaker_role"] == "customer")
    total_talk = agent_time + customer_time or 1

    # Single pass over segment boundaries: interruptions (negative gap),
    # silences (all gaps, unchanged from before), and pause events (gaps
    # long enough to be a notable/excessive silence, a subset of `silences`).
    interruptions = 0
    silences = []
    pause_events = []  # (start, end, gap, severity, preceding_role, following_role)
    for i in range(1, len(segments)):
        gap = segments[i]["start_time"] - segments[i - 1]["end_time"]
        if gap < 0:
            interruptions += 1
            silences.append(0)
            continue
        silences.append(gap)
        if gap >= 7.0:
            severity = "excessive"
        elif gap >= 3.0:
            severity = "notable"
        else:
            continue
        pause_events.append((
            segments[i - 1]["end_time"], segments[i]["start_time"], gap, severity,
            segments[i - 1]["speaker_role"], segments[i]["speaker_role"],
        ))

    notable_count = sum(1 for p in pause_events if p[3] == "notable")
    excessive_count = sum(1 for p in pause_events if p[3] == "excessive")
    hold_events = [p for p in pause_events if p[2] >= 15.0]

    talk_ratio_agent = round(agent_time / total_talk, 2)
    qa_scores = analysis.get("qa_scores", [])
    qa_overall = sum(s["score"] for s in qa_scores) / len(qa_scores) if qa_scores else 0

    # Composite 0-100 call health score. QA quality dominates (45%) as the
    # richest existing signal; talk balance and pause behavior split most of
    # the rest as independent, objectively-measurable conversational-health
    # signals; interruptions get the smallest weight since a single
    # interruption is weak evidence of a bad call.
    talk_component = max(0, 100 - abs(talk_ratio_agent - 0.5) * 200)
    interruption_component = max(0, 100 - interruptions * 8)
    pause_component = max(0, 100 - (notable_count * 4 + excessive_count * 12))
    health_score = round(
        0.45 * qa_overall + 0.20 * talk_component + 0.15 * interruption_component + 0.20 * pause_component, 1
    )

    db.add(ConversationAnalytics(
        call_id=call.id,
        duration_seconds=call.duration_seconds,
        avg_silence_seconds=round(sum(silences) / len(silences), 2) if silences else 0,
        longest_silence_seconds=round(max(silences), 2) if silences else 0,
        talk_ratio_agent=talk_ratio_agent,
        talk_ratio_customer=round(customer_time / total_talk, 2),
        interruption_count=interruptions,
        questions_asked=sum(1 for s in segments if "?" in s["text"]),
        questions_answered=max(0, sum(1 for s in segments if "?" in s["text"]) - 1),
        hold_count=len(hold_events),
        hold_duration_seconds=round(sum(p[2] for p in hold_events), 2),
        audio_quality_score=0.9,
        health_score=health_score,
    ))

    for start, end, gap, severity, prec, foll in pause_events:
        db.add(PauseEvent(
            call_id=call.id, start_time=start, end_time=end,
            duration_seconds=round(gap, 2), severity=severity,
            preceding_speaker=prec, following_speaker=foll,
        ))

    db.add(CustomerAnalytics(
        call_id=call.id,
        intent=analysis.get("intent"),
        mood=analysis.get("emotion", {}).get("dominant_customer"),
        risk_level=analysis.get("customer_risk_level", "low"),
        repeat_call_probability=analysis.get("repeat_call_probability", 0.1),
        escalation_risk=analysis.get("escalation_risk", 0.1),
        churn_risk=analysis.get("churn_risk", 0.1),
        csat_prediction=analysis.get("csat_prediction", 0.8),
    ))
    db.commit()
    _touch_job(db, call.id, JobStage.analytics, JobStatus.succeeded)


@celery_app.task(name="app.tasks.pipeline.backfill_playback")
def backfill_playback():
    """
    One-shot upgrade for calls processed before fast playback existed: their
    playback copy is a large PCM WAV and they have no precomputed waveform
    peaks, so the player had to download + decode the whole file before
    showing anything. Re-encodes each to the compact MP3 copy and stores
    peaks. Safe to re-run — already-upgraded calls are skipped.
    """
    db = SessionLocal()
    upgraded, failed = [], []
    try:
        calls = db.query(Call).filter(Call.status == CallStatus.processed).all()
        for call in calls:
            has_mp3 = minio_client.object_exists(minio_client.object_key_for_playback(call.id))
            has_peaks = bool((call.call_metadata or {}).get("waveform_peaks"))
            if has_mp3 and has_peaks:
                continue
            wav_key = minio_client.object_key_for_playback_wav(call.id)
            if not minio_client.object_exists(wav_key):
                continue
            try:
                wav_bytes = minio_client.download_audio_bytes(wav_key)
                if not has_mp3:
                    minio_client.upload_playback_audio(call.id, _to_mp3(wav_bytes))
                if not has_peaks:
                    call.call_metadata = {
                        **(call.call_metadata or {}),
                        "waveform_peaks": compute_waveform_peaks(wav_bytes),
                    }
                    db.commit()
                upgraded.append(call.id)
            except Exception:
                db.rollback()
                failed.append(call.id)
        return {"upgraded": len(upgraded), "failed": failed}
    finally:
        db.close()


@celery_app.task(name="app.tasks.pipeline.backfill_insights")
def backfill_insights():
    """
    One-shot backfill for calls processed before CallInsight existed: the
    original pipeline computed keywords/topics in its LLM pass but never
    persisted them. Re-runs a small LLM prompt over the transcript already
    stored in the DB — no re-transcription, no full pipeline re-run.
    """
    db = SessionLocal()
    llm = get_llm_provider()
    backfilled, failed = [], []
    try:
        candidates = (
            db.query(Call)
            .filter(Call.status == CallStatus.processed)
            .outerjoin(CallInsight, CallInsight.call_id == Call.id)
            .filter(CallInsight.id.is_(None))
            .all()
        )
        for call in candidates:
            transcript = db.query(Transcript).filter(Transcript.call_id == call.id).first()
            if not transcript or not transcript.full_text_masked:
                continue
            try:
                result = llm.generate_json(
                    "You extract concise structured metadata from customer support "
                    "call transcripts. Respond with only valid JSON.",
                    f"""TRANSCRIPT:
{transcript.full_text_masked}

Return JSON with this exact shape:
{{
  "main_topic": str,
  "sub_topics": [str],
  "keywords": [str],  // 5-10 short lowercase tags a support lead would filter by, e.g. "refund", "router restart"
  "intent": "complaint"|"inquiry"|"refund"|"billing"|"technical_support"|"cancellation"|"upgrade"|"sales",
  "outcome": "resolved"|"escalated"|"transferred"|"callback_required"|"unresolved",
  "executive_summary": str,  // one sentence
  "customer_phone": str|null,  // any phone number spoken/read back by either party, digits only; null ONLY if never mentioned. NOT account numbers or verification codes.
  "customer_email": str|null
}}""",
                )
                _stage_insights(db, call, result)
                # Opportunistic repair for the original bug: extractions from
                # before the fallback existed can be missing a phone/email
                # that is verbatim in the transcript. Fill nulls only.
                extraction = db.query(CallExtraction).filter(CallExtraction.call_id == call.id).first()
                if extraction:
                    if not extraction.customer_phone:
                        extraction.customer_phone = (
                            result.get("customer_phone")
                            or _find_phone_in_text(transcript.full_text_masked)
                        )
                    if not extraction.customer_email:
                        email_match = _EMAIL_RE.search(transcript.full_text_masked)
                        extraction.customer_email = result.get("customer_email") or (
                            email_match.group() if email_match else None
                        )
                    db.commit()
                backfilled.append(call.id)
            except Exception:
                db.rollback()
                failed.append(call.id)
        return {"backfilled": len(backfilled), "failed": failed}
    finally:
        db.close()


def _stage_timeline_and_recommendations(db, call: Call, analysis: dict):
    for e in analysis.get("timeline_events", []):
        db.add(TimelineEvent(
            call_id=call.id, event_type=e.get("event_type", "issue"),
            start_time=e.get("start_time", 0), end_time=e.get("end_time"),
            description=e.get("description"),
        ))
    for o in analysis.get("observations", []):
        db.add(AIObservation(
            call_id=call.id, observation_text=o.get("text", ""),
            timestamp_ref=o.get("timestamp"), category=o.get("category"),
        ))
    for r in analysis.get("recommendations", []):
        db.add(Recommendation(
            call_id=call.id, category=r.get("category", "coaching"),
            text=r.get("text", ""), priority=r.get("priority", "medium"),
        ))
    db.commit()
