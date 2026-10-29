"""GraphQL layer for the Forms module.

Direct port of the FB project's graphql/typeDefs.js + graphql/resolvers.js.
`auto_camel_case=False` keeps wire names verbatim (form_id, createdAt,
getEvaluationForms, saveEvaluationForm...) so the original Apollo Client
documents work unchanged. Like the original, auth is optional here: the JWT
is read when present, but resolvers fall back to the first user (or a
auto-created "system" user) so forms can always be saved.
"""

import json
from datetime import datetime
from typing import List, Optional
from urllib.parse import urlencode

import httpx
import jwt
import strawberry
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from strawberry.fastapi import BaseContext, GraphQLRouter
from strawberry.schema.config import StrawberryConfig

from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import EvaluationForm, EvaluationResponse, FormBuilderUser


class GraphQLContext(BaseContext):
    def __init__(self, db: Session, user: Optional[dict] = None):
        self.db = db
        self.user = user


def _user_from_request(request: Request) -> Optional[dict]:
    """Parse an optional `Authorization: Bearer <jwt>` header (never enforced)."""
    auth_header = request.headers.get("authorization")
    if not auth_header:
        return None
    token = auth_header.split(" ", 1)[1] if " " in auth_header else auth_header
    try:
        return jwt.decode(token, get_settings().forms_jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def get_context(request: Request, db: Session = Depends(get_db)) -> GraphQLContext:
    return GraphQLContext(db=db, user=_user_from_request(request))


def _get_creator_id(db: Session, context: GraphQLContext) -> int:
    # Ported from getCreatorId(): JWT user → first user → create system user.
    if context.user and context.user.get("id"):
        return int(context.user["id"])
    any_user = db.query(FormBuilderUser).order_by(FormBuilderUser.id.asc()).first()
    if any_user:
        return any_user.id
    system_user = FormBuilderUser(
        username="system",
        email="system@formbuilder.com",
        first_name="System",
        last_name="User",
        role="admin",
        is_active=True,
    )
    db.add(system_user)
    db.commit()
    db.refresh(system_user)
    return system_user.id


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


@strawberry.type
class EvaluationFormType:
    id: strawberry.ID
    form_id: str
    title: str
    form_content: str  # JSONB column exposed as a JSON-encoded string
    created_by: strawberry.ID
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


@strawberry.type
class EvaluationResponseType:
    id: strawberry.ID
    form_id: str
    inum: Optional[str] = None
    call_id: Optional[str] = None  # AgnoCall: call the evaluation was scored on
    responses: Optional[str] = None  # JSON-encoded string
    tags: Optional[str] = None  # JSON-encoded string
    user_id: Optional[strawberry.ID] = None
    score: Optional[float] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _form_to_type(form: EvaluationForm) -> EvaluationFormType:
    return EvaluationFormType(
        id=strawberry.ID(str(form.id)),
        form_id=form.form_id,
        title=form.title,
        form_content=json.dumps(form.form_content),
        created_by=strawberry.ID(str(form.created_by)),
        createdAt=_iso(form.created_at),
        updatedAt=_iso(form.updated_at),
    )


def _response_to_type(resp: EvaluationResponse) -> EvaluationResponseType:
    return EvaluationResponseType(
        id=strawberry.ID(str(resp.id)),
        form_id=resp.form_id,
        inum=resp.inum,
        call_id=str(resp.call_id) if resp.call_id else None,
        responses=json.dumps(resp.responses) if resp.responses is not None else None,
        tags=json.dumps(resp.tags) if resp.tags is not None else None,
        user_id=strawberry.ID(str(resp.user_id)) if resp.user_id is not None else None,
        score=resp.score,
        createdAt=_iso(resp.created_at),
        updatedAt=_iso(resp.updated_at),
    )


@strawberry.type
class Query:
    @strawberry.field
    def translateTexts(
        self,
        info: strawberry.Info,
        texts: List[str],
        target: str,
        source: Optional[str] = "en",
    ) -> List[Optional[str]]:
        """Auto-translate texts to `target` language (multilingual builder).
        Returns one entry per input text; None = translation unavailable."""
        results: List[Optional[str]] = []
        pending: list = []  # (result index, text)
        src = source or "en"
        for text in texts:
            if not text or not text.strip() or src == target:
                results.append(text)
                continue
            key = (src, target, text)
            if key in _translate_cache:
                results.append(_translate_cache[key])
                continue
            results.append(None)
            pending.append((len(results) - 1, text))

        for idx, text in pending:
            try:
                with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                    translated = ""
                    for provider in (_translate_one_gtx, _translate_one_mymemory):
                        try:
                            translated = provider(client, src, target, text)
                            if translated:
                                break
                        except Exception:
                            continue
                    if translated:
                        _translate_cache[(src, target, text)] = translated
                        results[idx] = translated
            except Exception:
                pass  # leave None - frontend falls back to source text
        return results

    @strawberry.field
    def getEvaluationForms(self, info: strawberry.Info) -> Optional[List[EvaluationFormType]]:
        db = info.context.db
        forms = db.query(EvaluationForm).order_by(EvaluationForm.created_at.desc()).all()
        return [_form_to_type(f) for f in forms]

    @strawberry.field
    def getEvaluationForm(self, info: strawberry.Info, id: strawberry.ID) -> Optional[EvaluationFormType]:
        form = (
            info.context.db.query(EvaluationForm)
            .filter(EvaluationForm.id == str(id))
            .first()
        )
        return _form_to_type(form) if form else None

    @strawberry.field
    def getEvaluationResponses(
        self, info: strawberry.Info, call_id: Optional[str] = None
    ) -> Optional[List[EvaluationResponseType]]:
        db = info.context.db
        query = db.query(EvaluationResponse)
        if call_id:
            # AgnoCall: only the evaluations submitted for a given call.
            query = query.filter(EvaluationResponse.call_id == call_id)
        responses = query.order_by(EvaluationResponse.created_at.desc()).all()
        return [_response_to_type(r) for r in responses]

    @strawberry.field
    def getEvaluationResponse(self, info: strawberry.Info, id: strawberry.ID) -> Optional[EvaluationResponseType]:
        resp = (
            info.context.db.query(EvaluationResponse)
            .filter(EvaluationResponse.id == str(id))
            .first()
        )
        return _response_to_type(resp) if resp else None


# ---------------------------------------------------------------------------
# Auto-translation (multilingual form builder)
# ---------------------------------------------------------------------------
# Two providers, tried in order: Google's public gtx endpoint (best quality)
# then MyMemory (free, no key). Results are cached in-process; if both fail
# the entry stays None so the frontend falls back to the source text and the
# user can type the translation manually.
_TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"
_MYMEMORY_URL = "https://api.mymemory.translated.net/get"
_translate_cache: dict = {}


def _fix_mojibake(text: str) -> str:
    """MyMemory sometimes returns UTF-8 bytes mis-decoded as cp1252/latin-1
    (e.g. 'à®•...' instead of Tamil). Repair it, or return "" if it can't be
    repaired so the next provider / source-text fallback is used."""
    if not text or not any(m in text for m in ("à®", "à¤", "Ã", "à¯", "â€")):
        return text
    for enc in ("cp1252", "latin-1"):
        try:
            fixed = text.encode(enc).decode("utf-8")
            if fixed:
                return fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return ""


def _translate_one_gtx(client: "httpx.Client", src: str, target: str, text: str) -> str:
    resp = client.get(
        _TRANSLATE_URL,
        params={"client": "gtx", "sl": src, "tl": target, "dt": "t", "q": text},
    )
    resp.raise_for_status()
    data = resp.json()
    return _fix_mojibake("".join(seg[0] for seg in (data[0] or []) if seg and seg[0]).strip())


def _translate_one_mymemory(client: "httpx.Client", src: str, target: str, text: str) -> str:
    resp = client.get(
        _MYMEMORY_URL,
        params={"q": text, "langpair": f"{src}|{target}"},
    )
    resp.raise_for_status()
    data = resp.json()
    # MyMemory reports quota/errors in JSON rather than HTTP status
    translated = (data.get("responseData") or {}).get("translatedText") or ""
    if data.get("quotaFinished") or "MYMEMORY WARNING" in translated.upper():
        return ""
    translated = _fix_mojibake(translated.strip())
    # MyMemory's fuzzy memory can return an unrelated long sentence for short
    # words ("High" -> a whole sentence). Reject results wildly longer than the
    # source or with a weak match score so the source text is kept instead.
    if len(translated) > 4 * len(text) + 12:
        return ""
    matches = data.get("matches") or []
    best = max((float(m.get("match") or 0) for m in matches), default=1.0)
    if len(text.split()) <= 2 and best < 0.6:
        return ""
    return translated


@strawberry.type
class Mutation:
    @strawberry.mutation
    def saveEvaluationForm(
        self, info: strawberry.Info, form_id: str, title: str, form_content: str
    ) -> EvaluationFormType:
        db = info.context.db
        existing = (
            db.query(EvaluationForm).filter(EvaluationForm.form_id == form_id).first()
        )
        if existing:
            # The original stored the raw string (Sequelize coerced it); parsing
            # keeps the JSONB column an object so reads round-trip identically.
            existing.title = title
            existing.form_content = json.loads(form_content)
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return _form_to_type(existing)
        created = EvaluationForm(
            form_id=form_id,
            title=title,
            form_content=json.loads(form_content),
            created_by=_get_creator_id(db, info.context),
        )
        db.add(created)
        db.commit()
        db.refresh(created)
        return _form_to_type(created)

    @strawberry.mutation
    def deleteEvaluationForm(self, info: strawberry.Info, id: strawberry.ID) -> bool:
        deleted = (
            info.context.db.query(EvaluationForm)
            .filter(EvaluationForm.id == str(id))
            .delete()
        )
        info.context.db.commit()
        return deleted > 0

    @strawberry.mutation
    def saveEvaluationResponse(
        self,
        info: strawberry.Info,
        form_id: str,
        inum: Optional[str] = None,
        call_id: Optional[str] = None,
        responses: Optional[str] = None,
        tags: Optional[str] = None,
        user_id: Optional[strawberry.ID] = None,
        score: Optional[float] = None,
    ) -> EvaluationResponseType:
        db = info.context.db
        resolved_user_id: Optional[int] = None
        if user_id is not None:
            resolved_user_id = int(user_id)
        else:
            try:
                resolved_user_id = _get_creator_id(db, info.context)
            except Exception:
                resolved_user_id = None
        created = EvaluationResponse(
            inum=inum,
            form_id=form_id,
            call_id=call_id,
            responses=json.loads(responses) if responses else None,
            tags=json.loads(tags) if tags else [],
            user_id=resolved_user_id,
            score=score,
        )
        db.add(created)
        db.commit()
        db.refresh(created)
        return _response_to_type(created)

    @strawberry.mutation
    def updateEvaluationResponse(
        self,
        info: strawberry.Info,
        id: strawberry.ID,
        inum: Optional[str] = None,
        form_id: Optional[str] = None,
        call_id: Optional[str] = None,
        responses: Optional[str] = None,
        tags: Optional[str] = None,
        user_id: Optional[strawberry.ID] = None,
        score: Optional[float] = strawberry.UNSET,
    ) -> Optional[EvaluationResponseType]:
        # Edit an already-submitted evaluation: only the provided arguments are
        # applied (strawberry UNSET = not sent), so callers can update a subset
        # of fields without clobbering the rest.
        db = info.context.db
        resp = (
            db.query(EvaluationResponse)
            .filter(EvaluationResponse.id == str(id))
            .first()
        )
        if resp is None:
            return None
        if inum is not None:
            resp.inum = inum
        if form_id is not None:
            resp.form_id = form_id
        if call_id is not None:
            resp.call_id = call_id
        if responses is not None:
            resp.responses = json.loads(responses)
        if tags is not None:
            resp.tags = json.loads(tags)
        if user_id is not None:
            resp.user_id = int(user_id)
        if score is not strawberry.UNSET:
            # explicit null allowed: non-scoring forms store NULL
            resp.score = score
        resp.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(resp)
        return _response_to_type(resp)

    @strawberry.mutation
    def deleteEvaluationResponse(self, info: strawberry.Info, id: strawberry.ID) -> bool:
        deleted = (
            info.context.db.query(EvaluationResponse)
            .filter(EvaluationResponse.id == str(id))
            .delete()
        )
        info.context.db.commit()
        return deleted > 0


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    # keep form_id / createdAt / getEvaluationForms verbatim on the wire
    config=StrawberryConfig(auto_camel_case=False),
)

# Mounted at /api/v1/graphql by main.py (the frontend's Apollo link targets
# `${NEXT_PUBLIC_API_BASE_URL}/graphql`).
graphql_router = GraphQLRouter(schema, context_getter=get_context, path="/graphql")
