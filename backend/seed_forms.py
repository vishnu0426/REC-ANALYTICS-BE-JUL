"""Forms module database setup + seeding.

Python port of the FB project's scripts/setup.js (`npm run setup-db`):
  1. Creates the tables if missing (same SQLAlchemy create_all the app runs
     at startup — covers users / rec_app_evaluation_forms /
     rec_app_evaluation_responses).
  2. Creates the same indexes as the original setup script.
  3. Seeds the admin user (admin / admin123) and the 10-field sample
     evaluation form, both idempotently.

Run from the backend directory:
    python seed_forms.py
"""

import json
import sys

import bcrypt

from app.core.database import Base, SessionLocal, engine
from app.models.models import EvaluationForm, FormBuilderUser  # registers tables on Base
from sqlalchemy import text

SAMPLE_FORM_CONTENT = {
    "fields": [
        {
            "id": "field_1",
            "type": "text",
            "label": "Agent Name",
            "description": "Enter the agent's name",
            "placeholder": "e.g. John Smith",
            "required": True,
            "borderStyle": "bordered",
            "alignment": "left",
            "max_score": 10,
        },
        {
            "id": "field_2",
            "type": "rating",
            "label": "Communication Skills",
            "description": "Rate the agent's communication skills",
            "required": True,
            "maxStars": 5,
            "star_scores": {"1": 2, "2": 4, "3": 6, "4": 8, "5": 10},
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
        {
            "id": "field_3",
            "type": "nps",
            "label": "How likely are you to recommend our service?",
            "description": "On a scale of 0-10",
            "required": True,
            "nps_min": 0,
            "nps_max": 10,
            "nps_scores": {
                "0": 0, "1": 10, "2": 20, "3": 30, "4": 40, "5": 50,
                "6": 60, "7": 70, "8": 80, "9": 90, "10": 100,
            },
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
        {
            "id": "field_4",
            "type": "yesno",
            "label": "Was your issue resolved?",
            "description": "Did the agent resolve your issue?",
            "required": True,
            "yes_score": 10,
            "no_score": 0,
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
        {
            "id": "field_5",
            "type": "segmented",
            "label": "Priority Level",
            "description": "Select the priority level",
            "required": True,
            "options": [
                {"label": "Low", "value": "low", "score": 3},
                {"label": "Medium", "value": "medium", "score": 6},
                {"label": "High", "value": "high", "score": 10},
            ],
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
        {
            "id": "field_6",
            "type": "slider",
            "label": "Overall Satisfaction",
            "description": "Rate your overall satisfaction",
            "required": True,
            "min": 0,
            "max": 100,
            "step": 1,
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
        {
            "id": "field_7",
            "type": "dropdown",
            "label": "Call Category",
            "description": "Select the call category",
            "required": True,
            "options": [
                {"label": "Billing", "value": "billing", "score": 5},
                {"label": "Technical Support", "value": "technical", "score": 8},
                {"label": "General Inquiry", "value": "general", "score": 3},
                {"label": "Complaint", "value": "complaint", "score": 10},
            ],
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
        {
            "id": "field_8",
            "type": "radio",
            "label": "Preferred Contact Method",
            "description": "How would you prefer to be contacted?",
            "required": True,
            "options": [
                {"label": "Email", "value": "email", "score": 5},
                {"label": "Phone", "value": "phone", "score": 5},
                {"label": "SMS", "value": "sms", "score": 5},
            ],
            "layout": "vertical",
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
        {
            "id": "field_9",
            "type": "checkbox",
            "label": "What topics were discussed?",
            "description": "Select all that apply",
            "required": False,
            "options": [
                {"label": "Account", "value": "account", "score": 3},
                {"label": "Payment", "value": "payment", "score": 3},
                {"label": "Technical", "value": "technical", "score": 3},
                {"label": "Feedback", "value": "feedback", "score": 3},
            ],
            "layout": "vertical",
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
        {
            "id": "field_10",
            "type": "textarea",
            "label": "Additional Comments",
            "description": "Any additional feedback",
            "placeholder": "Enter your comments here...",
            "required": False,
            "max_score": 10,
            "borderStyle": "bordered",
            "alignment": "left",
        },
    ],
    "total_score": 100,
    "hasScoring": True,
    "theme": {
        "mode": "dark",
        "backgroundColor": "#000000",
        "backgroundImage": "",
        "primaryColor": "#14b8a6",
    },
}

FORM_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_evaluation_forms_form_id ON rec_app_evaluation_forms(form_id)",
    "CREATE INDEX IF NOT EXISTS idx_evaluation_forms_created_by ON rec_app_evaluation_forms(created_by)",
    "CREATE INDEX IF NOT EXISTS idx_evaluation_responses_form_id ON rec_app_evaluation_responses(form_id)",
    "CREATE INDEX IF NOT EXISTS idx_evaluation_responses_user_id ON rec_app_evaluation_responses(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_evaluation_responses_inum ON rec_app_evaluation_responses(inum)",
]


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for statement in FORM_INDEXES:
            conn.execute(text(statement))
        # Added after first release: links an evaluation to the call it scored.
        conn.execute(text(
            "ALTER TABLE rec_app_evaluation_responses ADD COLUMN IF NOT EXISTS call_id UUID"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_evaluation_responses_call_id ON rec_app_evaluation_responses(call_id)"
        ))
    print("✓ Tables + indexes ensured")


def seed_admin(db) -> FormBuilderUser:
    admin = (
        db.query(FormBuilderUser)
        .filter(FormBuilderUser.username == "admin")
        .first()
    )
    if admin:
        print("✓ Admin user already exists")
        return admin
    hashed = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt(rounds=10)).decode()
    admin = FormBuilderUser(
        username="admin",
        password=hashed,
        email="admin@formbuilder.com",
        first_name="Admin",
        last_name="User",
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print("✓ Admin user created (username: admin, password: admin123)")
    return admin


def seed_sample_form(db, admin_id: int) -> None:
    existing = (
        db.query(EvaluationForm)
        .filter(EvaluationForm.form_id == "form_sample_evaluation")
        .first()
    )
    if existing:
        print("✓ Sample form already exists")
        return
    db.add(
        EvaluationForm(
            form_id="form_sample_evaluation",
            title="Sample Evaluation Form",
            form_content=SAMPLE_FORM_CONTENT,
            created_by=admin_id,
        )
    )
    db.commit()
    print("✓ Sample evaluation form created")


def main() -> None:
    # Windows consoles default to cp1252 and choke on the "✓" log marks.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print("\n=== Form Builder Database Setup ===\n")
    print("Step 1: Creating tables...")
    create_tables()

    print("\nStep 2: Seeding data...")
    db = SessionLocal()
    try:
        admin = seed_admin(db)
        seed_sample_form(db, admin.id)
    finally:
        db.close()

    print("\n=== Setup Complete ===")
    print("Default login: admin / admin123\n")


if __name__ == "__main__":
    main()
