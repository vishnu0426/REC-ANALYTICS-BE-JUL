import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, ForeignKey, DateTime, Text, Enum, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class CallStatus(str, enum.Enum):
    uploaded = "uploaded"
    validating = "validating"
    processing = "processing"
    processed = "processed"
    failed = "failed"


class JobStage(str, enum.Enum):
    audio = "audio"
    diarization = "diarization"
    speech = "speech"
    llm = "llm"
    qa = "qa"
    compliance = "compliance"
    analytics = "analytics"
    report = "report"


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    retrying = "retrying"


class Agent(Base):
    __tablename__ = "agents"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    external_agent_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    team = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    calls = relationship("Call", back_populates="agent")


class Call(Base):
    __tablename__ = "calls"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    agent_id = Column(UUID(as_uuid=False), ForeignKey("agents.id"), nullable=True)
    original_filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)  # MinIO object key
    status = Column(Enum(CallStatus), default=CallStatus.uploaded, nullable=False)
    failure_reason = Column(Text, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    language = Column(String, nullable=True)
    call_date = Column(DateTime, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    call_metadata = Column(JSON, default=dict)

    agent = relationship("Agent", back_populates="calls")
    transcript = relationship("Transcript", back_populates="call", uselist=False)
    jobs = relationship("ProcessingJob", back_populates="call")
    qa_evaluation = relationship("QAEvaluation", back_populates="call", uselist=False)
    compliance_violations = relationship("ComplianceViolation", back_populates="call")
    sentiment = relationship("SentimentAnalysis", back_populates="call", uselist=False)
    emotion = relationship("EmotionAnalysis", back_populates="call", uselist=False)
    conversation_analytics = relationship("ConversationAnalytics", back_populates="call", uselist=False)
    customer_analytics = relationship("CustomerAnalytics", back_populates="call", uselist=False)
    timeline_events = relationship("TimelineEvent", back_populates="call")
    observations = relationship("AIObservation", back_populates="call")
    recommendations = relationship("Recommendation", back_populates="call")
    extraction = relationship("CallExtraction", back_populates="call", uselist=False)
    classification = relationship("CallClassification", back_populates="call", uselist=False)
    labels = relationship("CallLabel", back_populates="call")
    pause_events = relationship("PauseEvent", back_populates="call")
    insight = relationship("CallInsight", back_populates="call", uselist=False)
    manual_qa_review = relationship("ManualQAReview", back_populates="call", uselist=False)


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    stage = Column(Enum(JobStage), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.queued, nullable=False)
    attempt_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    call = relationship("Call", back_populates="jobs")


class Transcript(Base):
    __tablename__ = "transcripts"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    pii_masked = Column(Boolean, default=True)
    full_text_masked = Column(Text, nullable=True)
    full_text_unmasked = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    call = relationship("Call", back_populates="transcript")
    segments = relationship("TranscriptSegment", back_populates="transcript", order_by="TranscriptSegment.sequence")


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    transcript_id = Column(UUID(as_uuid=False), ForeignKey("transcripts.id"), nullable=False)
    speaker_role = Column(String, default="unknown")  # agent | customer | unknown
    sequence = Column(Integer, nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    text_masked = Column(Text, nullable=False)
    text_unmasked = Column(Text, nullable=True)
    stt_confidence = Column(Float, default=0.95)

    transcript = relationship("Transcript", back_populates="segments")


class QAEvaluation(Base):
    __tablename__ = "qa_evaluations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    overall_score = Column(Float, nullable=False)
    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)
    coaching_suggestions = Column(Text, nullable=True)
    improvement_plan = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    call = relationship("Call", back_populates="qa_evaluation")
    criteria = relationship("QACriteriaScore", back_populates="evaluation")


class QACriteriaScore(Base):
    __tablename__ = "qa_criteria_scores"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    qa_evaluation_id = Column(UUID(as_uuid=False), ForeignKey("qa_evaluations.id"), nullable=False)
    criterion = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    explanation = Column(Text, nullable=True)
    timestamp_ref = Column(Float, nullable=True)
    transcript_evidence = Column(Text, nullable=True)
    confidence = Column(Float, default=0.9)

    evaluation = relationship("QAEvaluation", back_populates="criteria")


class ComplianceViolation(Base):
    __tablename__ = "compliance_violations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    rule_code = Column(String, nullable=False)
    category = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # low | medium | high | critical
    timestamp_ref = Column(Float, nullable=True)
    explanation = Column(Text, nullable=True)
    evidence = Column(Text, nullable=True)
    reviewed = Column(Boolean, default=False)
    review_outcome = Column(String, nullable=True)

    call = relationship("Call", back_populates="compliance_violations")


class SentimentAnalysis(Base):
    __tablename__ = "sentiment_analysis"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    overall_sentiment = Column(String, nullable=False)
    beginning_sentiment = Column(String, nullable=True)
    middle_sentiment = Column(String, nullable=True)
    end_sentiment = Column(String, nullable=True)
    timeline = Column(JSON, default=list)  # [{timestamp, score, label}]

    call = relationship("Call", back_populates="sentiment")


class EmotionAnalysis(Base):
    __tablename__ = "emotion_analysis"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    dominant_customer_emotion = Column(String, nullable=True)
    dominant_agent_emotion = Column(String, nullable=True)
    timeline = Column(JSON, default=list)  # [{timestamp, emotion, confidence}]

    call = relationship("Call", back_populates="emotion")


class ConversationAnalytics(Base):
    __tablename__ = "conversation_analytics"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    avg_silence_seconds = Column(Float, nullable=True)
    longest_silence_seconds = Column(Float, nullable=True)
    talk_ratio_agent = Column(Float, nullable=True)
    talk_ratio_customer = Column(Float, nullable=True)
    interruption_count = Column(Integer, default=0)
    questions_asked = Column(Integer, default=0)
    questions_answered = Column(Integer, default=0)
    hold_count = Column(Integer, default=0)
    hold_duration_seconds = Column(Float, default=0)
    audio_quality_score = Column(Float, nullable=True)
    health_score = Column(Float, nullable=True)  # composite 0-100, see pipeline.py::_stage_analytics

    call = relationship("Call", back_populates="conversation_analytics")


class CustomerAnalytics(Base):
    __tablename__ = "customer_analytics"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    intent = Column(String, nullable=True)
    mood = Column(String, nullable=True)
    risk_level = Column(String, nullable=True)  # low | medium | high
    repeat_call_probability = Column(Float, nullable=True)
    escalation_risk = Column(Float, nullable=True)
    churn_risk = Column(Float, nullable=True)
    csat_prediction = Column(Float, nullable=True)

    call = relationship("Call", back_populates="customer_analytics")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    event_type = Column(String, nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=True)
    description = Column(Text, nullable=True)

    call = relationship("Call", back_populates="timeline_events")


class AIObservation(Base):
    __tablename__ = "ai_observations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    observation_text = Column(Text, nullable=False)
    timestamp_ref = Column(Float, nullable=True)
    category = Column(String, nullable=True)

    call = relationship("Call", back_populates="observations")


class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    category = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    priority = Column(String, default="medium")

    call = relationship("Call", back_populates="recommendations")


class CallExtraction(Base):
    __tablename__ = "call_extractions"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    customer_account_id = Column(String, nullable=True)
    call_reason_primary = Column(String, nullable=True)
    call_reason_secondary = Column(String, nullable=True)
    resolution_summary = Column(Text, nullable=True)
    follow_up_required = Column(Boolean, default=False)
    follow_up_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    call = relationship("Call", back_populates="extraction")


class CallClassification(Base):
    __tablename__ = "call_classifications"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    category = Column(String, nullable=True)  # billing | technical_support | account_management | sales | cancellation | complaint | general_inquiry | other
    subcategory = Column(String, nullable=True)
    complexity = Column(String, nullable=True)  # low | medium | high
    confidence = Column(Float, default=0.85)
    created_at = Column(DateTime, default=datetime.utcnow)

    call = relationship("Call", back_populates="classification")


class CallLabel(Base):
    __tablename__ = "call_labels"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    label = Column(String, nullable=False)  # urgent | escalation_required | follow_up_needed | satisfaction_survey | training_opportunity | upsell_opportunity
    confidence = Column(Float, default=0.85)
    reason = Column(Text, nullable=True)

    call = relationship("Call", back_populates="labels")


class PauseEvent(Base):
    __tablename__ = "pause_events"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    duration_seconds = Column(Float, nullable=False)
    severity = Column(String, nullable=False)  # notable | excessive
    preceding_speaker = Column(String, nullable=True)  # agent | customer | unknown
    following_speaker = Column(String, nullable=True)

    call = relationship("Call", back_populates="pause_events")


class CallInsight(Base):
    __tablename__ = "call_insights"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False, unique=True)
    main_topic = Column(String, nullable=True)
    intent = Column(String, nullable=True)
    outcome = Column(String, nullable=True)  # resolved | escalated | transferred | callback_required | unresolved
    root_cause = Column(Text, nullable=True)
    executive_summary = Column(Text, nullable=True)
    detailed_summary = Column(Text, nullable=True)
    sub_topics = Column(JSON, default=list)  # [str]
    keywords = Column(JSON, default=list)  # [str]
    key_discussion_points = Column(JSON, default=list)  # [str]
    action_items = Column(JSON, default=list)  # [{description, owner}]
    created_at = Column(DateTime, default=datetime.utcnow)

    call = relationship("Call", back_populates="insight")


class ManualQAReview(Base):
    __tablename__ = "manual_qa_reviews"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    call_id = Column(UUID(as_uuid=False), ForeignKey("calls.id"), nullable=False, unique=True)
    reviewer_name = Column(String, nullable=False)
    status = Column(String, default="draft", nullable=False)  # draft | completed
    overall_score = Column(Float, nullable=True)  # avg of manual criterion scores, computed server-side
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    call = relationship("Call", back_populates="manual_qa_review")
    criteria = relationship("ManualQACriteriaScore", back_populates="review", cascade="all, delete-orphan")


class ManualQACriteriaScore(Base):
    __tablename__ = "manual_qa_criteria_scores"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    review_id = Column(UUID(as_uuid=False), ForeignKey("manual_qa_reviews.id"), nullable=False)
    criterion = Column(String, nullable=False)
    ai_score = Column(Float, nullable=True)  # AI score snapshot at review time
    manual_score = Column(Float, nullable=True)  # null = reviewer marked N/A (excluded from overall)
    comment = Column(Text, nullable=True)

    review = relationship("ManualQAReview", back_populates="criteria")


# ---------------------------------------------------------------------------
# Forms module (ported from the standalone Form Builder project: table names,
# column names and types intentionally match the original Sequelize models so
# existing form_builder databases keep working unchanged).
# ---------------------------------------------------------------------------

class FormBuilderUser(Base):
    """Ported from FB models/user.js — tableName 'users'."""

    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(255), nullable=False, unique=True)
    password = Column(String(255), nullable=True)  # bcrypt hash
    email = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    role = Column(String(50), nullable=True, default="agent")
    is_active = Column(Boolean, nullable=True, default=True)
    auth_provider = Column(String(50), nullable=True, default="local")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class EvaluationForm(Base):
    """Ported from FB models/evaluation_form.js — tableName 'rec_app_evaluation_forms'."""

    __tablename__ = "rec_app_evaluation_forms"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    form_id = Column(String(255), nullable=False, unique=True)  # business key used by upserts
    title = Column(String(255), nullable=False)
    form_content = Column(JSONB, nullable=False)  # {fields, total_score, hasScoring, theme}
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class EvaluationResponse(Base):
    """Ported from FB models/evaluation_response.js — tableName 'rec_app_evaluation_responses'."""

    __tablename__ = "rec_app_evaluation_responses"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    inum = Column(String(255), nullable=True)  # external reference number
    form_id = Column(String(255), nullable=False)  # holds EvaluationForm.form_id (string), not its UUID
    # AgnoCall addition: links a form evaluation to the call it scored
    # (nullable, plain column — the forms module stays decoupled from calls).
    call_id = Column(UUID(as_uuid=False), nullable=True, index=True)
    responses = Column(JSONB, nullable=True)  # {fieldId: value}
    tags = Column(JSONB, nullable=True, default=list)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
