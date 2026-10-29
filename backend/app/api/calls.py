from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.models.models import (
    Call, Agent, CallStatus, ProcessingJob, JobStage, JobStatus,
    Transcript, QAEvaluation, ComplianceViolation, SentimentAnalysis,
    TimelineEvent, ConversationAnalytics, CustomerAnalytics,
    CallExtraction, CallClassification, CallLabel, PauseEvent,
    EmotionAnalysis, AIObservation, Recommendation,
    CallInsight, ManualQAReview, ManualQACriteriaScore,
)
from app.schemas.schemas import (
    CallAccepted, CallSummary, CallListResponse, TranscriptOut, TranscriptSegmentOut,
    QAEvaluationOut, ComplianceViolationOut, SentimentOut, TimelineEventOut,
    CallAnalyticsOut, CallExtractionOut, CallClassificationOut, CallLabelOut,
    PauseEventOut, EmotionOut, AIObservationOut, RecommendationOut, ProcessingJobOut,
    CallInsightOut, ManualQAReviewIn, ManualQAReviewOut,
)
from app.core.failures import classify_failure
from app.core.timing import processing_duration
from app.storage import minio_client
from app.tasks.pipeline import run_pipeline

router = APIRouter(prefix="/calls", tags=["Calls"])

ALLOWED_EXTENSIONS = {"wav", "mp3", "flac", "m4a"}


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def status_is_failed(call: Call) -> bool:
    return (call.status.value if hasattr(call.status, "value") else call.status) == "failed"


def _to_summary(call: Call) -> CallSummary:
    qa_score = call.qa_evaluation.overall_score if call.qa_evaluation else None
    risk = call.customer_analytics.risk_level if call.customer_analytics else None
    review = call.manual_qa_review
    return CallSummary(
        manual_reviewed=bool(review and review.status == "completed"),
        manual_qa_score=review.overall_score if review else None,
        id=call.id,
        status=call.status.value if hasattr(call.status, "value") else call.status,
        agent_name=call.agent.name if call.agent else None,
        duration_seconds=call.duration_seconds,
        call_date=call.call_date,
        overall_qa_score=qa_score,
        compliance_violation_count=len(call.compliance_violations or []),
        risk_level=risk,
        original_filename=call.original_filename,
        category=call.classification.category if call.classification else None,
        health_score=call.conversation_analytics.health_score if call.conversation_analytics else None,
        labels=[l.label for l in (call.labels or [])],
        failure_reason=call.failure_reason,
        failure=classify_failure(call.failure_reason) if status_is_failed(call) else None,
        processing_duration_seconds=processing_duration(call),
    )


@router.post("", response_model=CallAccepted, status_code=202)
async def upload_call(
    file: UploadFile = File(...),
    agent_external_id: Optional[str] = Form(None),
    agent_name: Optional[str] = Form(None),
    call_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    ext = _extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type .{ext}. Allowed: {sorted(ALLOWED_EXTENSIONS)}")

    agent = None
    if agent_external_id or agent_name:
        agent = db.query(Agent).filter(Agent.external_agent_id == agent_external_id).first()
        if not agent:
            agent = Agent(external_agent_id=agent_external_id, name=agent_name or "Unknown Agent")
            db.add(agent)
            db.flush()

    call = Call(
        original_filename=file.filename,
        storage_path="",  # set once uploaded
        status=CallStatus.uploaded,
        agent_id=agent.id if agent else None,
        call_date=datetime.fromisoformat(call_date) if call_date else datetime.utcnow(),
    )
    db.add(call)
    db.flush()  # assigns call.id without committing yet

    file_bytes = await file.read()
    object_key = minio_client.upload_audio(call.id, file.filename, file_bytes, file.content_type)
    call.storage_path = object_key
    db.commit()
    db.refresh(call)

    # In a real MinIO deployment the bucket's event notification (configured
    # in docker-compose's minio-init service) fires the webhook below on its
    # own once the PUT above lands, which is what actually enqueues the
    # pipeline. We also enqueue directly here so upload -> processing works
    # immediately in dev even before MinIO's own event delivery is wired up
    # (e.g. first run, before minio-init has finished configuring the bucket).
    run_pipeline.delay(call.id)

    return CallAccepted(call_id=call.id, status=call.status.value)


@router.get("", response_model=CallListResponse)
def list_calls(
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
):
    base_query = db.query(Call)
    if status:
        base_query = base_query.filter(Call.status == status)
    if risk_level:
        # Joined (not filtered post-fetch in Python) so `total` and the
        # paginated page agree -- a Python-side filter after LIMIT/OFFSET
        # would under-fill a page and make the page count wrong whenever
        # this filter is active.
        base_query = base_query.join(CustomerAnalytics).filter(CustomerAnalytics.risk_level == risk_level)
    total = base_query.count()

    query = base_query.options(
        joinedload(Call.agent),
        joinedload(Call.qa_evaluation),
        selectinload(Call.compliance_violations),
        joinedload(Call.customer_analytics),
        joinedload(Call.classification),
        joinedload(Call.conversation_analytics),
        selectinload(Call.labels),
        joinedload(Call.manual_qa_review),
    )
    calls = query.order_by(Call.uploaded_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    results = [_to_summary(c) for c in calls]
    return CallListResponse(items=results, total=total, page=page, page_size=page_size)


@router.get("/{call_id}", response_model=CallSummary)
def get_call(call_id: str, db: Session = Depends(get_db)):
    call = db.query(Call).options(
        joinedload(Call.agent), joinedload(Call.qa_evaluation),
        selectinload(Call.compliance_violations), joinedload(Call.customer_analytics),
        joinedload(Call.classification), joinedload(Call.conversation_analytics),
        selectinload(Call.labels), joinedload(Call.manual_qa_review),
    ).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(404, "Call not found")
    return _to_summary(call)


@router.post("/{call_id}/reprocess", response_model=CallAccepted, status_code=202)
def reprocess_call(call_id: str, db: Session = Depends(get_db)):
    """Re-queues a failed call. Uses the same atomic conditional UPDATE the
    pipeline claims with, so a double-click can't enqueue it twice."""
    claimed = db.query(Call).filter(
        Call.id == call_id, Call.status == CallStatus.failed,
    ).update({"status": CallStatus.validating, "failure_reason": None}, synchronize_session=False)
    db.commit()
    if not claimed:
        raise HTTPException(409, "Only failed calls can be reprocessed")
    run_pipeline.delay(call_id)
    return CallAccepted(call_id=call_id, status=CallStatus.validating.value)


@router.get("/{call_id}/audio")
def get_audio_url(call_id: str, db: Session = Depends(get_db)):
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call or not call.storage_path:
        raise HTTPException(404, "Call or audio not found")
    # Prefer the normalized, browser-playable copy written during
    # transcription (see minio_client.object_key_for_playback) — the
    # original upload is never re-encoded in place and may use a codec (e.g.
    # G.729, common from PBX/SIP sources) no browser can decode. Falls back
    # to the original for calls that haven't reached that pipeline stage yet.
    mp3_key = minio_client.object_key_for_playback(call_id)
    wav_key = minio_client.object_key_for_playback_wav(call_id)
    if minio_client.object_exists(mp3_key):
        key, source = mp3_key, "playback"
    elif minio_client.object_exists(wav_key):
        key, source = wav_key, "playback"
    else:
        # `source: original` lets the frontend warn that the browser may not
        # be able to decode the un-transcoded upload.
        key, source = call.storage_path, "original"
    url = minio_client.get_presigned_audio_url(key)
    # Precomputed peaks let the player draw the waveform immediately and
    # stream the audio on demand instead of downloading the whole file first.
    peaks = (call.call_metadata or {}).get("waveform_peaks")
    return {
        "url": url,
        "expires_minutes": 30,
        "source": source,
        "peaks": peaks,
        "duration": call.duration_seconds,
    }


@router.get("/{call_id}/transcript", response_model=TranscriptOut)
def get_transcript(call_id: str, db: Session = Depends(get_db)):
    transcript = db.query(Transcript).filter(Transcript.call_id == call_id).first()
    if not transcript:
        raise HTTPException(404, "Transcript not available yet")
    return TranscriptOut(
        call_id=call_id,
        pii_masked=transcript.pii_masked,
        segments=[
            TranscriptSegmentOut(
                sequence=s.sequence, speaker_role=s.speaker_role,
                start_time=s.start_time, end_time=s.end_time,
                text=s.text_masked, stt_confidence=s.stt_confidence,
            ) for s in transcript.segments
        ],
    )


@router.get("/{call_id}/qa", response_model=QAEvaluationOut)
def get_qa(call_id: str, db: Session = Depends(get_db)):
    qa = db.query(QAEvaluation).filter(QAEvaluation.call_id == call_id).first()
    if not qa:
        raise HTTPException(404, "QA evaluation not available yet")
    return qa


@router.get("/{call_id}/compliance", response_model=List[ComplianceViolationOut])
def get_compliance(call_id: str, db: Session = Depends(get_db)):
    return db.query(ComplianceViolation).filter(ComplianceViolation.call_id == call_id).all()


@router.get("/{call_id}/sentiment", response_model=SentimentOut)
def get_sentiment(call_id: str, db: Session = Depends(get_db)):
    sentiment = db.query(SentimentAnalysis).filter(SentimentAnalysis.call_id == call_id).first()
    if not sentiment:
        raise HTTPException(404, "Sentiment not available yet")
    return sentiment


@router.get("/{call_id}/timeline", response_model=List[TimelineEventOut])
def get_timeline(call_id: str, db: Session = Depends(get_db)):
    return db.query(TimelineEvent).filter(TimelineEvent.call_id == call_id).order_by(TimelineEvent.start_time).all()


@router.get("/{call_id}/analytics", response_model=CallAnalyticsOut)
def get_analytics(call_id: str, db: Session = Depends(get_db)):
    conv = db.query(ConversationAnalytics).filter(ConversationAnalytics.call_id == call_id).first()
    cust = db.query(CustomerAnalytics).filter(CustomerAnalytics.call_id == call_id).first()

    def to_dict(obj):
        if not obj:
            return None
        return {c.name: getattr(obj, c.name) for c in obj.__table__.columns if c.name not in ("id", "call_id")}

    return CallAnalyticsOut(conversation=to_dict(conv), customer=to_dict(cust))


@router.get("/{call_id}/extraction", response_model=CallExtractionOut)
def get_extraction(call_id: str, db: Session = Depends(get_db)):
    extraction = db.query(CallExtraction).filter(CallExtraction.call_id == call_id).first()
    if not extraction:
        raise HTTPException(404, "Extraction not available yet")
    return extraction


@router.get("/{call_id}/classification", response_model=CallClassificationOut)
def get_classification(call_id: str, db: Session = Depends(get_db)):
    classification = db.query(CallClassification).filter(CallClassification.call_id == call_id).first()
    if not classification:
        raise HTTPException(404, "Classification not available yet")
    return classification


@router.get("/{call_id}/labels", response_model=List[CallLabelOut])
def get_labels(call_id: str, db: Session = Depends(get_db)):
    return db.query(CallLabel).filter(CallLabel.call_id == call_id).all()


@router.get("/{call_id}/pauses", response_model=List[PauseEventOut])
def get_pauses(call_id: str, db: Session = Depends(get_db)):
    return db.query(PauseEvent).filter(PauseEvent.call_id == call_id).order_by(PauseEvent.start_time).all()


@router.get("/{call_id}/emotion", response_model=EmotionOut)
def get_emotion(call_id: str, db: Session = Depends(get_db)):
    emotion = db.query(EmotionAnalysis).filter(EmotionAnalysis.call_id == call_id).first()
    if not emotion:
        raise HTTPException(404, "Emotion analysis not available yet")
    return emotion


@router.get("/{call_id}/observations", response_model=List[AIObservationOut])
def get_observations(call_id: str, db: Session = Depends(get_db)):
    return db.query(AIObservation).filter(AIObservation.call_id == call_id).all()


@router.get("/{call_id}/recommendations", response_model=List[RecommendationOut])
def get_recommendations(call_id: str, db: Session = Depends(get_db)):
    return db.query(Recommendation).filter(Recommendation.call_id == call_id).all()


@router.get("/{call_id}/insights", response_model=CallInsightOut)
def get_insights(call_id: str, db: Session = Depends(get_db)):
    insight = db.query(CallInsight).filter(CallInsight.call_id == call_id).first()
    if not insight:
        raise HTTPException(404, "Insights not available yet")
    return insight


@router.get("/{call_id}/manual-qa", response_model=ManualQAReviewOut)
def get_manual_qa(call_id: str, db: Session = Depends(get_db)):
    review = db.query(ManualQAReview).filter(ManualQAReview.call_id == call_id).first()
    if not review:
        raise HTTPException(404, "No manual QA review for this call yet")
    return review


@router.put("/{call_id}/manual-qa", response_model=ManualQAReviewOut)
def upsert_manual_qa(call_id: str, payload: ManualQAReviewIn, db: Session = Depends(get_db)):
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(404, "Call not found")
    if payload.status not in ("draft", "completed"):
        raise HTTPException(400, "status must be 'draft' or 'completed'")
    if not payload.reviewer_name.strip():
        raise HTTPException(400, "reviewer_name is required")

    review = db.query(ManualQAReview).filter(ManualQAReview.call_id == call_id).first()
    if not review:
        review = ManualQAReview(call_id=call_id, reviewer_name=payload.reviewer_name)
        db.add(review)
        db.flush()
    else:
        # Full-replace upsert: the panel always submits the complete review.
        db.query(ManualQACriteriaScore).filter(
            ManualQACriteriaScore.review_id == review.id
        ).delete(synchronize_session=False)

    review.reviewer_name = payload.reviewer_name.strip()
    review.status = payload.status
    review.notes = payload.notes
    # N/A criteria (manual_score null) stay on the review for the record but
    # are excluded from the overall — same rule the AI pipeline uses.
    scores = [c.manual_score for c in payload.criteria if c.manual_score is not None]
    review.overall_score = round(sum(scores) / len(scores), 1) if scores else None

    for c in payload.criteria:
        db.add(ManualQACriteriaScore(
            review_id=review.id,
            criterion=c.criterion,
            ai_score=c.ai_score,
            manual_score=c.manual_score,
            comment=c.comment,
        ))
    db.commit()
    db.refresh(review)
    return review


@router.get("/{call_id}/jobs", response_model=List[ProcessingJobOut])
def get_jobs(call_id: str, db: Session = Depends(get_db)):
    """Per-stage timing breakdown (e.g. how long transcription vs. LLM
    analysis took), sourced from ProcessingJob rows the pipeline already
    writes via `_touch_job()`. Stages that don't call `_touch_job` (currently
    extraction/labeling, sentiment/emotion, timeline/recommendations — see
    pipeline.py) won't have a row and simply won't appear here."""
    jobs = db.query(ProcessingJob).filter(ProcessingJob.call_id == call_id).order_by(ProcessingJob.started_at).all()
    return [
        ProcessingJobOut(
            stage=j.stage.value if hasattr(j.stage, "value") else j.stage,
            status=j.status.value if hasattr(j.status, "value") else j.status,
            started_at=j.started_at,
            completed_at=j.completed_at,
            duration_seconds=round((j.completed_at - j.started_at).total_seconds(), 1)
            if j.started_at and j.completed_at else None,
            error_message=j.error_message,
        )
        for j in jobs
    ]
