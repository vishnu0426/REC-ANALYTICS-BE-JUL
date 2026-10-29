from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func

from app.core.database import get_db
from app.core.failures import classify_failure
from app.core.timing import processing_duration
from app.models.models import Call, CallStatus, Agent, QAEvaluation, ComplianceViolation, ConversationAnalytics, CustomerAnalytics
from app.schemas.schemas import AgentSummary, AgentDetail, CallSummary

router = APIRouter(prefix="/agents", tags=["Agents"])


def _agent_metrics(db: Session, agent_ids: Optional[List[str]] = None):
    # Five independent GROUP BY queries merged in Python, rather than one big
    # multi-join: joining ComplianceViolation (1:N) alongside
    # avg(QAEvaluation.overall_score) in the same query would multiply rows
    # and corrupt the QA average (classic join-fanout bug).
    call_q = db.query(Call.agent_id, func.count(Call.id))
    qa_q = db.query(Call.agent_id, func.avg(QAEvaluation.overall_score)).join(
        QAEvaluation, QAEvaluation.call_id == Call.id
    )
    health_q = db.query(Call.agent_id, func.avg(ConversationAnalytics.health_score)).join(
        ConversationAnalytics, ConversationAnalytics.call_id == Call.id
    )
    violation_q = db.query(Call.agent_id, func.count(ComplianceViolation.id)).join(
        ComplianceViolation, ComplianceViolation.call_id == Call.id
    )
    risk_q = (
        db.query(Call.agent_id, func.count(CustomerAnalytics.id))
        .join(CustomerAnalytics, CustomerAnalytics.call_id == Call.id)
        .filter(CustomerAnalytics.risk_level == "high")
    )
    if agent_ids is not None:
        call_q = call_q.filter(Call.agent_id.in_(agent_ids))
        qa_q = qa_q.filter(Call.agent_id.in_(agent_ids))
        health_q = health_q.filter(Call.agent_id.in_(agent_ids))
        violation_q = violation_q.filter(Call.agent_id.in_(agent_ids))
        risk_q = risk_q.filter(Call.agent_id.in_(agent_ids))
    return (
        dict(call_q.group_by(Call.agent_id).all()),
        dict(qa_q.group_by(Call.agent_id).all()),
        dict(health_q.group_by(Call.agent_id).all()),
        dict(violation_q.group_by(Call.agent_id).all()),
        dict(risk_q.group_by(Call.agent_id).all()),
    )


def _to_agent_summary(a: Agent, calls, qa, health, violations, risk) -> AgentSummary:
    return AgentSummary(
        id=a.id, name=a.name, team=a.team, external_agent_id=a.external_agent_id,
        call_count=calls.get(a.id, 0),
        avg_qa_score=round(qa[a.id], 1) if qa.get(a.id) is not None else None,
        avg_health_score=round(health[a.id], 1) if health.get(a.id) is not None else None,
        violation_count=violations.get(a.id, 0),
        high_risk_call_count=risk.get(a.id, 0),
    )


def _to_call_summary(call: Call) -> CallSummary:
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


@router.get("", response_model=List[AgentSummary])
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(Agent).all()
    calls, qa, health, violations, risk = _agent_metrics(db)
    return [_to_agent_summary(a, calls, qa, health, violations, risk) for a in agents]


@router.get("/{agent_id}", response_model=AgentDetail)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    calls, qa, health, violations, risk = _agent_metrics(db, agent_ids=[agent_id])

    recent = (
        db.query(Call)
        .options(
            joinedload(Call.agent), joinedload(Call.qa_evaluation),
            selectinload(Call.compliance_violations), joinedload(Call.customer_analytics),
            joinedload(Call.classification), joinedload(Call.conversation_analytics),
            selectinload(Call.labels),
        )
        .filter(Call.agent_id == agent_id)
        .order_by(Call.uploaded_at.desc())
        .limit(20)
        .all()
    )

    summary = _to_agent_summary(agent, calls, qa, health, violations, risk)
    return AgentDetail(**summary.dict(), recent_calls=[_to_call_summary(c) for c in recent])
