# server/app/routers/ai.py

# ── Standard library ────────────────────────────────────────────────────────────
from datetime import date, timedelta
from typing import Literal, Optional

# ── Third-party ────────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

# ── Local imports ──────────────────────────────────────────────────────────────
from ..core.config import settings
from ..db.database import get_db
from ..db.crud_ai import create_ai_task, list_ai_tasks, update_ai_task_status, get_ai_task
from ..services.ai_client import chat_with_gemini
from ..schemas.ai_actions import (
    AIProposal,
    InterpretResponse,
    AddWorkoutPayload,
    AITaskCreate,
    AITaskOut,
)

# Router
router = APIRouter(prefix="/ai", tags=["AI"])

# ── Schemas used only by this router ───────────────────────────────────────────
Role = Literal["system", "user", "assistant"]


class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: Optional[int] = None


class ChatReply(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str


# ── Helpers ────────────────────────────────────────────────────────────────────
def _mock_reply(messages: list[ChatMessage]) -> str:
    """Very small heuristic for mock mode."""
    last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
    lu = last_user.lower()
    if "plan" in lu:
        return "cool — tell me your goal and how many days/week, and i’ll draft a plan."
    if "bench" in lu:
        return "try 3×5 at an rpe 7–8; add 2.5–5 lb next week if all reps move well."
    return "got it! what do you want to work on — strength, hypertrophy, or general fitness?"


# ── Routes: chat / models ──────────────────────────────────────────────────────
@router.post("/chat", response_model=ChatReply)
async def chat(req: ChatRequest) -> ChatReply:
    """
    Chat endpoint. Uses mock response when AI_MOCK is true or no API key is set.
    """
    if settings.AI_MOCK or not settings.GEMINI_API_KEY:
        return ChatReply(content=_mock_reply(req.messages))

    try:
        content = chat_with_gemini(
            [m.model_dump() for m in req.messages],
            settings.GEMINI_API_KEY,
            settings.AI_MODEL,
        )
        return ChatReply(content=content)
    except Exception as e:  # bubble up as a 502 to the client
        raise HTTPException(status_code=502, detail=f"gemini error: {e}") from e


@router.get("/models")
def list_models():
    """
    Convenience endpoint: list text-capable Gemini models (supports generateContent).
    """
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    out: list[str] = []
    for m in genai.list_models():
        if "generateContent" in getattr(m, "supported_generation_methods", []):
            out.append(m.name)
    return {"models": out}


# ── Routes: interpret / tasks ──────────────────────────────────────────────────
@router.post("/plan/interpret", response_model=InterpretResponse)
async def interpret(req: ChatRequest) -> InterpretResponse:
    """
    Mock-only interpreter: read the last user message and propose a safe 'add_workout'.
    No side-effects. The UI can render proposals for user confirmation.
    """
    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "").strip()

    # very light heuristics for title, schedule for tomorrow
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    title = "Workout"
    lu = last_user.lower()
    if "push" in lu:
        title = "Push Day"
    elif "pull" in lu:
        title = "Pull Day"
    elif "legs" in lu or "leg" in lu:
        title = "Leg Day"

    payload = AddWorkoutPayload(date=tomorrow, title=title, notes="").model_dump()

    proposal = AIProposal(
        intent="add_workout",
        payload=payload,
        summary=f"Add '{title}' on {tomorrow}.",
        confidence=0.75,
        requires_confirmation=True,
        requires_super_confirmation=False,
    )

    return InterpretResponse(
        assistant_text=f"I can add **{title}** on {tomorrow}. Want me to queue that?",
        proposals=[proposal],
    )


@router.post("/tasks/queue", response_model=list[AITaskOut])
def queue_tasks(items: list[AITaskCreate], db: Session = Depends(get_db)) -> list[AITaskOut]:
    """
    Accept one or more proposals and store them in the queue as AITask rows.
    Returns the queued tasks.
    """
    out: list[AITaskOut] = []
    for it in items:
        task = create_ai_task(
            db,
            user_id=it.user_id,
            intent=it.intent,
            payload=it.payload,
            summary=it.summary,
            confidence=it.confidence,
            requires_confirmation=it.requires_confirmation,
            requires_super_confirmation=it.requires_super_confirmation,
            dedupe_key=it.dedupe_key,
        )
        # Convert ORM → Pydantic so datetimes serialize correctly
        out.append(AITaskOut.model_validate(task, from_attributes=True))
    return out


@router.get("/tasks", response_model=list[AITaskOut])
def list_tasks(
    user_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> list[AITaskOut]:
    """
    List queued tasks for a user (optionally filter by status).
    """
    tasks = list_ai_tasks(db, user_id=user_id, status=status)
    # Ensure ORM objects are serialized properly
    return [AITaskOut.model_validate(t, from_attributes=True) for t in tasks]

@router.post("/tasks/{task_id}/approve", response_model=AITaskOut)
def approve_task(
    task_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    t = get_ai_task(db, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="task not found")
    if t.status not in ("queued", "rejected"):
        raise HTTPException(status_code=409, detail=f"cannot approve from status '{t.status}'")
    return update_ai_task_status(db, task_id, "approved")

@router.post("/tasks/{task_id}/reject", response_model=AITaskOut)
def reject_task(
    task_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    t = get_ai_task(db, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="task not found")
    if t.status not in ("queued", "approved"):
        raise HTTPException(status_code=409, detail=f"cannot reject from status '{t.status}'")
    return update_ai_task_status(db, task_id, "rejected")