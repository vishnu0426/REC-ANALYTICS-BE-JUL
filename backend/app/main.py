from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.core.config import get_settings
from app.core.database import Base, engine
from app.storage.minio_client import ensure_bucket
from app.api import calls, dashboard, internal, agents, compliance, analytics, forms, forms_graphql

app = FastAPI(
    title="Enterprise AI Call Recording Analysis Platform",
    version="1.0.0",
    description="Analyzes recorded customer support calls into AI-generated investigation reports.",
)

app.add_middleware(
    CORSMiddleware,
    # Set FRONTEND_ORIGIN in production; "*" remains the dev default.
    allow_origins=[get_settings().frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calls.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(internal.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(compliance.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")

# Forms module (ported from the standalone Form Builder project).
app.include_router(forms.router, prefix="/api/v1")
app.include_router(forms.auth_router, prefix="/api/v1")
app.include_router(forms_graphql.graphql_router, prefix="/api/v1")

# Form uploads land in backend/public/uploads and are served back verbatim.
_form_uploads_dir = Path(__file__).resolve().parents[1] / "public" / "uploads"
_form_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/v1/uploads", StaticFiles(directory=str(_form_uploads_dir)), name="form-uploads")


def _ensure_incremental_columns():
    # create_all() only creates missing TABLES, it never ALTERs an existing
    # one. This closes that gap for columns added to already-existing tables
    # (e.g. `health_score` on `conversation_analytics`) so a pre-existing dev
    # DB self-heals on next startup instead of needing a manual psql step.
    # Replaced by `alembic upgrade head` in a real deployment, same as
    # create_all() above.
    inspector = inspect(engine)
    if "conversation_analytics" not in inspector.get_table_names():
        return  # create_all() just created it above, column already included
    existing = {c["name"] for c in inspector.get_columns("conversation_analytics")}
    if "health_score" not in existing:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE conversation_analytics ADD COLUMN IF NOT EXISTS health_score FLOAT"
            ))
    # manual_score became nullable (null = criterion marked N/A by the
    # reviewer) after the table first shipped with NOT NULL.
    if "manual_qa_criteria_scores" in inspector.get_table_names():
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE manual_qa_criteria_scores ALTER COLUMN manual_score DROP NOT NULL"
            ))
    # Forms module: call_id links an evaluation-form submission to the call
    # it scored; added after rec_app_evaluation_responses first shipped.
    if "rec_app_evaluation_responses" in inspector.get_table_names():
        existing = {c["name"] for c in inspector.get_columns("rec_app_evaluation_responses")}
        if "call_id" not in existing:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE rec_app_evaluation_responses ADD COLUMN IF NOT EXISTS call_id UUID"
                ))


# Postgres does not index foreign keys automatically, so every per-call
# endpoint and every list-page join was a sequential scan of its child table.
# (table, column) pairs; `CREATE INDEX IF NOT EXISTS` keeps this idempotent.
_INDEXES = [
    ("calls", "status"), ("calls", "uploaded_at"), ("calls", "agent_id"),
    ("processing_jobs", "call_id"), ("transcripts", "call_id"),
    ("transcript_segments", "transcript_id"), ("qa_evaluations", "call_id"),
    ("qa_criteria_scores", "qa_evaluation_id"), ("compliance_violations", "call_id"),
    ("sentiment_analysis", "call_id"), ("emotion_analysis", "call_id"),
    ("conversation_analytics", "call_id"), ("customer_analytics", "call_id"),
    ("timeline_events", "call_id"), ("ai_observations", "call_id"),
    ("recommendations", "call_id"), ("call_extractions", "call_id"),
    ("call_classifications", "call_id"), ("call_labels", "call_id"),
    ("pause_events", "call_id"),
]


def _ensure_indexes():
    with engine.begin() as conn:
        for table, column in _INDEXES:
            conn.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{table}_{column} ON {table} ({column})"))


@app.on_event("startup")
def on_startup():
    # Dev convenience: create tables if they don't exist yet. In a real
    # deployment this is replaced entirely by `alembic upgrade head`.
    Base.metadata.create_all(bind=engine)
    _ensure_incremental_columns()
    _ensure_indexes()
    ensure_bucket()


@app.get("/health")
def health():
    return {"status": "ok"}
