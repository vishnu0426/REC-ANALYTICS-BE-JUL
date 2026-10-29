from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func

from app.core.database import get_db
from app.core.failures import classify_failure
from app.core.timing import processing_duration
from app.models.models import Call, CallStatus, QAEvaluation, ComplianceViolation, CustomerAnalytics
from app.schemas.schemas import DashboardSummary, CallSummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    # One grouped query instead of four separate COUNTs.
    by_status = dict(db.query(Call.status, func.count(Call.id)).group_by(Call.status).all())
    total = sum(by_status.values())
    processed = by_status.get(CallStatus.processed, 0)
    processing = by_status.get(CallStatus.processing, 0)
    failed = by_status.get(CallStatus.failed, 0)

    avg_qa = db.query(func.avg(QAEvaluation.overall_score)).scalar()
    high_risk = db.query(func.count(CustomerAnalytics.id)).filter(CustomerAnalytics.risk_level == "high").scalar() or 0

    calls_with_violations = db.query(func.count(func.distinct(ComplianceViolation.call_id))).scalar() or 0
    compliance_percent = None
    if processed:
        compliance_percent = round(100 * (1 - (calls_with_violations / processed)), 1)

    recent = (
        db.query(Call)
        .options(joinedload(Call.agent), joinedload(Call.qa_evaluation),
                 selectinload(Call.compliance_violations), joinedload(Call.customer_analytics),
                 joinedload(Call.classification), joinedload(Call.conversation_analytics),
                 selectinload(Call.labels))
        .order_by(Call.uploaded_at.desc())
        .limit(10)
        .all()
    )

    def to_summary(call):
        return CallSummary(
            id=call.id,
            status=call.status.value if hasattr(call.status, "value") else call.status,
            agent_name=call.agent.name if call.agent else None,
            duration_seconds=call.duration_seconds,
            call_date=call.call_date,
            overall_qa_score=call.qa_evaluation.overall_score if call.qa_evaluation else None,
            compliance_violation_count=len(call.compliance_violations or []),
            risk_level=call.customer_analytics.risk_level if call.customer_analytics else None,
            original_filename=call.original_filename,
            category=call.classification.category if call.classification else None,
            health_score=call.conversation_analytics.health_score if call.conversation_analytics else None,
            labels=[l.label for l in (call.labels or [])],
            failure_reason=call.failure_reason,
            failure=classify_failure(call.failure_reason) if call.status == CallStatus.failed else None,
            processing_duration_seconds=processing_duration(call),
        )

    return DashboardSummary(
        total_calls=total,
        processed=processed,
        processing=processing,
        failed=failed,
        average_qa=round(avg_qa, 1) if avg_qa else None,
        compliance_percent=compliance_percent,
        high_risk_calls=high_risk,
        recent_calls=[to_summary(c) for c in recent],
    )
