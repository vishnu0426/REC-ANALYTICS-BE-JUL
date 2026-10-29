"""REST layer for the Forms module.

Direct port of the FB project's server.js REST routes (auth, evaluations,
evaluation responses, file upload). The React frontend talks to the GraphQL
endpoint in forms_graphql.py; these routes exist for full API parity with the
original Node server, including its JWT auth (HS256, 24h, bcrypt hashes).
"""

import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

import bcrypt
import jwt
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import EvaluationForm, EvaluationResponse, FormBuilderUser
from app.schemas.schemas import (
    EvaluationFormOut,
    EvaluationFormUpsertIn,
    EvaluationResponseIn,
    EvaluationResponseOut,
    EvaluationResponseUpdateIn,
    RegisteredUserOut,
    TokenOut,
    UploadOut,
    UserAuthIn,
    UserOut,
    UserRegisterIn,
)

router = APIRouter(prefix="/forms", tags=["Forms"])
# FB served these at /api/auth/*; here they live under /api/v1/auth/*.
auth_router = APIRouter(prefix="/auth", tags=["Forms Auth"])

# backend/app/api/forms.py -> backend/public/uploads (mirrors FB's public/uploads)
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "public" / "uploads"


def require_auth(authorization: str = Header(default=None)) -> dict:
    """Port of server.js authenticateToken(): 401 without token, 403 on bad token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Access denied")
    token = authorization.split(" ", 1)[1] if " " in authorization else authorization
    try:
        return jwt.decode(token, get_settings().forms_jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=403, detail="Invalid token")


def _form_out(form: EvaluationForm) -> EvaluationFormOut:
    return EvaluationFormOut(
        id=str(form.id),
        form_id=form.form_id,
        title=form.title,
        form_content=json.dumps(form.form_content),
        created_by=form.created_by,
        updated_by=form.updated_by,
        created_at=form.created_at,
        updated_at=form.updated_at,
    )


def _response_out(resp: EvaluationResponse) -> EvaluationResponseOut:
    return EvaluationResponseOut(
        id=str(resp.id),
        inum=resp.inum,
        form_id=resp.form_id,
        call_id=str(resp.call_id) if resp.call_id else None,
        responses=json.dumps(resp.responses) if resp.responses is not None else None,
        tags=json.dumps(resp.tags) if resp.tags is not None else None,
        user_id=resp.user_id,
        score=resp.score,
        created_at=resp.created_at,
        updated_at=resp.updated_at,
    )


# --- Auth ------------------------------------------------------------------

@auth_router.post("/login", response_model=TokenOut)
def login(payload: UserAuthIn, db: Session = Depends(get_db)):
    user = (
        db.query(FormBuilderUser)
        .filter(FormBuilderUser.username == payload.username)
        .first()
    )
    if not user or not user.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(payload.password.encode(), user.password.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = jwt.encode(
        {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "exp": datetime.utcnow() + timedelta(hours=24),
        },
        get_settings().forms_jwt_secret,
        algorithm="HS256",
    )
    return TokenOut(
        token=token,
        user=UserOut(
            id=user.id,
            username=user.username,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
        ),
    )


@auth_router.post("/register", response_model=RegisteredUserOut, status_code=201)
def register(payload: UserRegisterIn, db: Session = Depends(get_db)):
    hashed = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt(rounds=10)).decode()
    user = FormBuilderUser(
        username=payload.username,
        password=hashed,
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return RegisteredUserOut(id=user.id, username=user.username)


# --- Evaluation forms --------------------------------------------------------

@router.get("", response_model=List[EvaluationFormOut])
def list_forms(db: Session = Depends(get_db), _user: dict = Depends(require_auth)):
    forms = db.query(EvaluationForm).order_by(EvaluationForm.created_at.desc()).all()
    return [_form_out(f) for f in forms]


@router.post("", response_model=EvaluationFormOut)
def upsert_form(
    payload: EvaluationFormUpsertIn,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    existing = (
        db.query(EvaluationForm)
        .filter(EvaluationForm.form_id == payload.form_id)
        .first()
    )
    if existing:
        existing.title = payload.title
        existing.form_content = json.loads(payload.form_content)
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return _form_out(existing)
    created = EvaluationForm(
        form_id=payload.form_id,
        title=payload.title,
        form_content=json.loads(payload.form_content),
        created_by=int(user["id"]),
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return _form_out(created)


# NOTE: registered before /{form_id} so "responses" isn't captured as an id.
@router.get("/responses", response_model=List[EvaluationResponseOut])
def list_responses(
    call_id: str = None,
    form_id: str = None,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_auth),
):
    query = db.query(EvaluationResponse)
    if call_id:
        # Evaluations submitted from a call's QA Scorecard carry the call id.
        query = query.filter(EvaluationResponse.call_id == call_id)
    if form_id:
        query = query.filter(EvaluationResponse.form_id == form_id)
    responses = query.order_by(EvaluationResponse.created_at.desc()).all()
    return [_response_out(r) for r in responses]


@router.post("/responses", response_model=EvaluationResponseOut, status_code=201)
def create_response(
    payload: EvaluationResponseIn,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    resolved_user_id = payload.user_id
    if resolved_user_id is None:
        try:
            resolved_user_id = int(user["id"])
        except (KeyError, TypeError, ValueError):
            resolved_user_id = None
    created = EvaluationResponse(
        inum=payload.inum,
        form_id=payload.form_id,
        call_id=payload.call_id,
        responses=json.loads(payload.responses) if payload.responses else None,
        tags=json.loads(payload.tags) if payload.tags else [],
        user_id=resolved_user_id,
        score=payload.score,
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return _response_out(created)


@router.put("/responses/{response_id}", response_model=EvaluationResponseOut)
def update_response(
    response_id: str,
    payload: EvaluationResponseUpdateIn,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_auth),
):
    """Partial update of a submitted evaluation (edit an existing evaluation)."""
    resp = (
        db.query(EvaluationResponse)
        .filter(EvaluationResponse.id == response_id)
        .first()
    )
    if resp is None:
        raise HTTPException(status_code=404, detail="Evaluation response not found")
    if payload.inum is not None:
        resp.inum = payload.inum
    if payload.form_id is not None:
        resp.form_id = payload.form_id
    if payload.call_id is not None:
        resp.call_id = payload.call_id
    if payload.responses is not None:
        resp.responses = json.loads(payload.responses)
    if payload.tags is not None:
        resp.tags = json.loads(payload.tags)
    if payload.user_id is not None:
        resp.user_id = payload.user_id
    if payload.score is not None:
        resp.score = payload.score
    resp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(resp)
    return _response_out(resp)


@router.delete("/{form_id}", response_model=dict)
def delete_form(form_id: str, db: Session = Depends(get_db), _user: dict = Depends(require_auth)):
    deleted = (
        db.query(EvaluationForm).filter(EvaluationForm.id == form_id).delete()
    )
    db.commit()
    return {"success": deleted > 0}


# --- File upload --------------------------------------------------------------

@router.post("/upload", response_model=UploadOut)
def upload_file(
    file: UploadFile = File(...),
    _user: dict = Depends(require_auth),
):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    # Same naming scheme as the original multer storage: <timestamp>-<original>
    filename = f"{int(time.time() * 1000)}-{file.filename}"
    target = UPLOAD_DIR / filename
    with target.open("wb") as out:
        out.write(file.file.read())
    return UploadOut(url=f"/api/v1/uploads/{filename}")
