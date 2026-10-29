from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.database import get_db
from app.models.models import Call, CallStatus, ComplianceViolation
from app.schemas.schemas import ComplianceSummary, ComplianceRuleBreakdown, ComplianceViolationWithCallOut

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.get("/summary", response_model=ComplianceSummary)
def compliance_summary(db: Session = Depends(get_db)):
    total_processed = db.query(func.count(Call.id)).filter(Call.status == CallStatus.processed).scalar() or 0
    calls_with_violations = db.query(func.count(func.distinct(ComplianceViolation.call_id))).scalar() or 0
    clean_percent = round(100 * (1 - calls_with_violations / total_processed), 1) if total_processed else None

    by_rule_rows = (
        db.query(ComplianceViolation.rule_code, ComplianceViolation.category, func.count(ComplianceViolation.id))
        .group_by(ComplianceViolation.rule_code, ComplianceViolation.category)
        .order_by(func.count(ComplianceViolation.id).desc())
        .all()
    )
    by_severity = dict(
        db.query(ComplianceViolation.severity, func.count(ComplianceViolation.id))
        .group_by(ComplianceViolation.severity).all()
    )
    # ComplianceViolation has no wall-clock timestamp of its own (only
    # timestamp_ref, the in-call audio offset), so "recent" is ordered via
    # the parent call's upload time.
    recent = (
        db.query(ComplianceViolation)
        .join(Call, Call.id == ComplianceViolation.call_id)
        .options(joinedload(ComplianceViolation.call).joinedload(Call.agent))
        .order_by(Call.uploaded_at.desc())
        .limit(20)
        .all()
    )

    return ComplianceSummary(
        total_processed_calls=total_processed,
        calls_with_violations=calls_with_violations,
        clean_call_percent=clean_percent,
        by_rule=[ComplianceRuleBreakdown(rule_code=r, category=c, count=n) for r, c, n in by_rule_rows],
        by_severity=by_severity,
        recent_violations=[
            ComplianceViolationWithCallOut(
                id=v.id, rule_code=v.rule_code, category=v.category, severity=v.severity,
                timestamp_ref=v.timestamp_ref, explanation=v.explanation, evidence=v.evidence,
                reviewed=v.reviewed, review_outcome=v.review_outcome,
                call_id=v.call_id, call_filename=v.call.original_filename,
                agent_name=v.call.agent.name if v.call.agent else None,
            ) for v in recent
        ],
    )
