"""
Org-wide analytics aggregates for the /analytics page.

Everything is served from one endpoint so the page renders atomically from a
single fetch. Aggregation happens in Python over narrow column queries —
volumes here are per-tenant call recordings (hundreds to low thousands of
rows), far below where pushing GROUP BYs into SQL would matter, and it keeps
the weekday/keyword logic portable across Postgres/SQLite dev setups.
"""
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    Call, CallStatus, Agent, QAEvaluation, QACriteriaScore,
    SentimentAnalysis, EmotionAnalysis, CallClassification, CallInsight,
    CallExtraction, ConversationAnalytics, ManualQAReview, ManualQACriteriaScore,
)
from app.schemas.schemas import (
    AnalyticsOverview, HeatmapCell, KeywordStat, SentimentTrendDay,
    QACalibration, CriterionDelta,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

SENTIMENT_VALUE = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}


def _kpis(db: Session) -> dict:
    processed_calls = db.query(Call).filter(Call.status == CallStatus.processed).all()
    total = len(processed_calls)

    avg_qa = db.query(QAEvaluation.overall_score).all()
    avg_health = db.query(ConversationAnalytics.health_score).filter(
        ConversationAnalytics.health_score.isnot(None)).all()
    end_sentiments = db.query(SentimentAnalysis.end_sentiment).all()
    negative_end = sum(1 for (s,) in end_sentiments if s == "negative")
    follow_ups = db.query(CallExtraction).filter(CallExtraction.follow_up_required.is_(True)).count()
    unresolved = db.query(CallInsight).filter(
        CallInsight.outcome.in_(["escalated", "unresolved", "callback_required"])).count()
    durations = [c.duration_seconds for c in processed_calls if c.duration_seconds]

    def avg(rows):
        vals = [r[0] for r in rows if r[0] is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    return {
        "processed_calls": total,
        "avg_qa_score": avg(avg_qa),
        "avg_health_score": avg(avg_health),
        "negative_end_percent": round(100 * negative_end / len(end_sentiments), 1) if end_sentiments else None,
        "avg_duration_seconds": round(sum(durations) / len(durations)) if durations else None,
        "follow_up_required": follow_ups,
        "needs_attention": unresolved,
    }


def _volume_heatmap(db: Session) -> list[HeatmapCell]:
    counts = Counter()
    for (call_date,) in db.query(Call.call_date).filter(Call.call_date.isnot(None)).all():
        counts[(WEEKDAYS[call_date.weekday()], str(call_date.hour))] += 1
    return [
        HeatmapCell(row=day, col=str(hour), value=float(counts.get((day, str(hour)), 0)),
                    n=counts.get((day, str(hour)), 0))
        for day in WEEKDAYS for hour in range(24)
        if counts.get((day, str(hour)), 0) > 0
    ]


def _agent_criteria_heatmap(db: Session) -> list[HeatmapCell]:
    rows = (
        db.query(Agent.name, QACriteriaScore.criterion, QACriteriaScore.score)
        .select_from(QACriteriaScore)
        .join(QAEvaluation, QACriteriaScore.qa_evaluation_id == QAEvaluation.id)
        .join(Call, QAEvaluation.call_id == Call.id)
        .outerjoin(Agent, Call.agent_id == Agent.id)
        .all()
    )
    acc = defaultdict(list)
    for agent_name, criterion, score in rows:
        if score is not None:
            acc[(agent_name or "Unassigned", criterion)].append(score)
    return [
        HeatmapCell(row=agent, col=criterion, value=round(sum(scores) / len(scores), 1), n=len(scores))
        for (agent, criterion), scores in sorted(acc.items())
    ]


def _category_stats(db: Session) -> list[dict]:
    """Treemap feed: one node per call category, sized by volume, colored by
    avg sentiment — the 'Discover Trends' style categories panel."""
    rows = (
        db.query(CallClassification.category, SentimentAnalysis.overall_sentiment, QAEvaluation.overall_score)
        .join(Call, Call.id == CallClassification.call_id)
        .outerjoin(SentimentAnalysis, SentimentAnalysis.call_id == Call.id)
        .outerjoin(QAEvaluation, QAEvaluation.call_id == Call.id)
        .filter(CallClassification.category.isnot(None))
        .all()
    )
    acc: dict[str, dict] = {}
    for category, sentiment, qa in rows:
        entry = acc.setdefault(category.replace("_", " "), {"count": 0, "sent": [], "qa": []})
        entry["count"] += 1
        if sentiment in SENTIMENT_VALUE:
            entry["sent"].append(SENTIMENT_VALUE[sentiment])
        if qa is not None:
            entry["qa"].append(qa)
    return [
        {
            "category": cat,
            "count": e["count"],
            "avg_sentiment": round(sum(e["sent"]) / len(e["sent"]), 2) if e["sent"] else None,
            "avg_qa": round(sum(e["qa"]) / len(e["qa"]), 1) if e["qa"] else None,
        }
        for cat, e in sorted(acc.items(), key=lambda kv: -kv[1]["count"])
    ]


def _keywords(db: Session, limit: int = 60) -> list[KeywordStat]:
    rows = (
        db.query(CallInsight.keywords, SentimentAnalysis.overall_sentiment)
        .outerjoin(SentimentAnalysis, SentimentAnalysis.call_id == CallInsight.call_id)
        .all()
    )
    counts = Counter()
    sentiment_acc = defaultdict(list)
    for keywords, overall in rows:
        for kw in set(k.strip().lower() for k in (keywords or []) if isinstance(k, str) and k.strip()):
            counts[kw] += 1
            if overall in SENTIMENT_VALUE:
                sentiment_acc[kw].append(SENTIMENT_VALUE[overall])
    return [
        KeywordStat(
            keyword=kw,
            count=n,
            avg_sentiment=round(sum(sentiment_acc[kw]) / len(sentiment_acc[kw]), 2) if sentiment_acc[kw] else None,
        )
        for kw, n in counts.most_common(limit)
    ]


def _sentiment_trend(db: Session, days: int = 30) -> list[SentimentTrendDay]:
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(Call.call_date, SentimentAnalysis.overall_sentiment)
        .join(SentimentAnalysis, SentimentAnalysis.call_id == Call.id)
        .filter(Call.call_date.isnot(None), Call.call_date >= since)
        .all()
    )
    per_day = defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0})
    for call_date, overall in rows:
        bucket = per_day[call_date.strftime("%Y-%m-%d")]
        bucket[overall if overall in bucket else "neutral"] += 1
    return [
        SentimentTrendDay(day=day, **counts) for day, counts in sorted(per_day.items())
    ]


def _emotion_distribution(db: Session) -> dict:
    rows = db.query(EmotionAnalysis.dominant_customer_emotion).all()
    counts = Counter(e.strip().lower() for (e,) in rows if e)
    return dict(counts.most_common(12))


def _qa_calibration(db: Session) -> QACalibration:
    reviews = db.query(ManualQAReview).filter(ManualQAReview.status == "completed").all()
    review_ids = [r.id for r in reviews]

    overall_deltas = []
    for r in reviews:
        ai = db.query(QAEvaluation.overall_score).filter(QAEvaluation.call_id == r.call_id).scalar()
        if ai is not None and r.overall_score is not None:
            overall_deltas.append(abs(ai - r.overall_score))

    by_criterion = defaultdict(list)
    if review_ids:
        for c in db.query(ManualQACriteriaScore).filter(
                ManualQACriteriaScore.review_id.in_(review_ids)).all():
            if c.ai_score is not None and c.manual_score is not None:
                by_criterion[c.criterion].append(c.manual_score - c.ai_score)

    return QACalibration(
        reviewed_calls=len(reviews),
        mean_abs_delta=round(sum(overall_deltas) / len(overall_deltas), 1) if overall_deltas else None,
        agreement_percent=round(100 * sum(1 for d in overall_deltas if d <= 10) / len(overall_deltas), 1)
        if overall_deltas else None,
        by_criterion=[
            CriterionDelta(criterion=crit, avg_delta=round(sum(ds) / len(ds), 1), n=len(ds))
            for crit, ds in sorted(by_criterion.items())
        ],
    )


@router.get("/overview", response_model=AnalyticsOverview)
def analytics_overview(db: Session = Depends(get_db)):
    return AnalyticsOverview(
        kpis=_kpis(db),
        volume_heatmap=_volume_heatmap(db),
        agent_criteria_heatmap=_agent_criteria_heatmap(db),
        category_stats=_category_stats(db),
        keywords=_keywords(db),
        sentiment_trend=_sentiment_trend(db),
        emotion_distribution=_emotion_distribution(db),
        qa_calibration=_qa_calibration(db),
    )
