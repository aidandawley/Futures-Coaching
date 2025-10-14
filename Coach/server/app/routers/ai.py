# server/app/routers/ai.py

# ── Standard library ────────────────────────────────────────────────────────────
from datetime import date, datetime, timedelta
from typing import Literal, Optional
import re

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

SYSTEM_PROMPT = """
You are an AI strength coach embedded inside a workout planner app.

Your job:
-Say "Yo Whats UP!" at the start of every message
- Chat naturally and help plan training.
- When the user asks to change the schedule (add, move, edit, delete workouts, or add sets),
  you DO NOT edit the calendar yourself. Instead, you suggest a concrete proposal and ask
  for confirmation. The app will queue and apply changes after the user confirms.

Behavior:
- Keep replies concise (1–3 sentences).
-If the user asks you to create a workout with excercises for them use your better judgment. Prescribe them basic excericises
that are considered staples in the gym
-List out all workouts the user gives or you want to give with numbers next to them in yourt follow up message. You are making a plan
- If the user gives a date like 10/16/2025 or 2025-10-16, treat it literally.
- If information is missing (e.g., no date/title), ask a targeted follow-up question.
- When you’re ready to propose, say something like:
  "I can add **Push Day** on 2025-10-16. Want me to queue that?"
- Never say "I can't add it" or "I'm just a text AI"; proposals are how you cause changes.
"""

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


# --- lightweight date parsing for interpret() ---
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _next_weekday(start: date, weekday_idx: int) -> date:
    """Return the next occurrence of weekday_idx (Mon=0..Sun=6) after start."""
    delta = (weekday_idx - start.weekday()) % 7
    if delta == 0:
        delta = 7
    return start + timedelta(days=delta)


def _parse_date_from_text(text: str, today: date) -> Optional[date]:
    t = text.lower().strip()

    # 1) explicit ISO yyyy-mm-dd
    m = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", t)
    if m:
        y, mo, d = map(int, m.groups())
        try:
            return date(y, mo, d)
        except ValueError:
            pass

    # 2) mm/dd or mm-dd (assume current year)
    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})\b", t)
    if m:
        mo, d = map(int, m.groups())
        try:
            return date(today.year, mo, d)
        except ValueError:
            pass

    # 3) relative words
    if "today" in t:
        return today
    if "tomorrow" in t:
        return today + timedelta(days=1)

    # 4) "in N days"
    m = re.search(r"\bin\s+(\d{1,2})\s+days?\b", t)
    if m:
        n = int(m.group(1))
        return today + timedelta(days=n)

    # 5) weekday names: "friday", "next tuesday"
    for idx, name in enumerate(WEEKDAYS):
        if re.search(rf"\b(next\s+)?{name}\b", t):
            if f"next {name}" in t:
                base = today + timedelta(days=7)
                return _next_weekday(base, idx)
            return _next_weekday(today, idx)

    return None


# ── Routes: chat / models ──────────────────────────────────────────────────────
@router.post("/chat", response_model=ChatReply)
async def chat(req: ChatRequest) -> ChatReply:
    """
    Chat endpoint. Uses mock response when AI_MOCK is true or no API key is set.
    """
    if settings.AI_MOCK or not settings.GEMINI_API_KEY:
        return ChatReply(content=_mock_reply(req.messages))

    try:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages += [m.model_dump() for m in req.messages]

        content = chat_with_gemini(
    messages,                                  
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


@router.post("/plan/interpret", response_model=InterpretResponse)
async def interpret(req: ChatRequest) -> InterpretResponse:
    """
    Read the chat transcript, extract a target date + workout title, and return
    proposals the UI can confirm. We return:
      1) add_workout (date + title)
      2) optionally an upsert_sets proposal with suggested sets (NO workout_id yet)
    The UI will apply the sets right after creating the workout, once it knows the id.
    """
    # --- Gather user text ------------------------------------------------------
    user_msgs = [m.content for m in req.messages if m.role == "user"]
    full_user_text = " ".join(user_msgs).strip()
    last_user = user_msgs[-1].strip() if user_msgs else ""
    lu_last = last_user.lower()
    lu_full = full_user_text.lower()

    # --- Utilities -------------------------------------------------------------
    def _safe_date(y: int, m: int, d: int) -> str | None:
        try:
            return date(year=y, month=m, day=d).isoformat()
        except ValueError:
            return None

    # Prefer the *last* date the user mentioned; otherwise fallback to tomorrow
    def _extract_iso_date_preferring_last() -> str:
        # quick keywords (on the last message for conversational feel)
        if "today" in lu_last:
            return date.today().isoformat()
        if "tomorrow" in lu_last:
            return (date.today() + timedelta(days=1)).isoformat()

        candidates: list[str] = []

        # yyyy-mm-dd or yyyy/mm/dd
        for m in re.finditer(r"\b(\d{4})[-/](\d{2})[-/](\d{2})\b", lu_full):
            y, mm, dd = map(int, m.groups())
            iso = _safe_date(y, mm, dd)
            if iso:
                candidates.append(iso)

        # mm-dd-yyyy or mm/dd/yyyy (and support 2-digit year)
        for m in re.finditer(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b", lu_full):
            mm, dd, yy = m.groups()
            mm, dd = int(mm), int(dd)
            yy = int(yy)
            if yy < 100:  # normalize 2-digit years
                yy += 2000
            iso = _safe_date(yy, mm, dd)
            if iso:
                candidates.append(iso)

        # If nothing matched, default to tomorrow
        return candidates[-1] if candidates else (date.today() + timedelta(days=1)).isoformat()

    # --- Parse date & title ----------------------------------------------------
    parsed_date = _extract_iso_date_preferring_last()

    # Title heuristics — prefer explicit push/pull/legs hints from *last* msg
    title = "Workout"
    if "push" in lu_last:
        title = "Push Day"
    elif "pull" in lu_last:
        title = "Pull Day"
    elif "legs" in lu_last or "leg day" in lu_last or re.search(r"\bleg(s)?\b", lu_last):
        title = "Leg Day"

    # Allow “call it … / name it …” patterns to override
    m = re.search(r"(call it|name it|title it)\s+([^\n.,;]+)", last_user, flags=re.I)
    if m:
        custom = m.group(2).strip()
        if custom:
            title = custom

    # --- Suggest sets (OPTIONAL) ----------------------------------------------
    # If the user mentions exercises, build sensible defaults for reps/count.
    CANON = [
        ("bench press", 5, None, 3),
        ("incline dumbbell press", 10, None, 3),
        ("overhead press", 8, None, 3),
        ("lateral raise", 12, None, 3),
        ("squat", 5, None, 3),
        ("deadlift", 5, None, 3),
        ("barbell row", 8, None, 3),
        ("dumbbell row", 10, None, 3),
        ("dip", 8, None, 3),
        ("curl", 12, None, 3),
        ("triceps pushdown", 12, None, 3),
        ("incline press", 8, None, 3),  # catch broader phrasing
    ]

    picked_sets: list[dict] = []

    # Map a few aliases so looser language still hits
    aliases = {
        "bench": "bench press",
        "ohp": "overhead press",
        "press": "overhead press",  # if context is push day, this is reasonable
        "row": "barbell row",
        "incline": "incline dumbbell press",
        "pushdowns": "triceps pushdown",
        "pushdown": "triceps pushdown",
        "lateral raises": "lateral raise",
    }

    # Build a normalized search string to match tokens
    norm = lu_full

    # Collect any canonical names that appear
    seen = set()
    for name, reps, weight, count in CANON:
        if name in norm:
            seen.add(name)

    # Add by alias
    for token, canonical in aliases.items():
        if re.search(rf"\b{re.escape(token)}\b", norm):
            seen.add(canonical)

    # If no explicit exercises but the user said "push", propose a basic push template
    if not seen and ("push" in lu_last or "push day" in lu_last):
        seen.update(["bench press", "overhead press", "lateral raise"])

    # Materialize the set specs in the order of CANON
    for name, reps, weight, count in CANON:
        if name in seen:
            picked_sets.append(
                {"exercise": name, "reps": reps, "weight": weight, "count": count}
            )

    # --- Build proposals -------------------------------------------------------
    add_payload = AddWorkoutPayload(
        date=parsed_date,
        title=title,
        notes="",  # not abusing notes anymore
    ).model_dump()

    add_proposal = AIProposal(
        intent="add_workout",
        payload=add_payload,
        summary=f"Add '{title}' on {parsed_date}.",
        confidence=0.75,
        requires_confirmation=True,
        requires_super_confirmation=False,
    )

    proposals: list[AIProposal] = [add_proposal]

    # If we have suggested sets, include a second proposal (workout_id unknown yet)
    if picked_sets:
        upsert_payload = {
            "workout_id": 0,     # placeholder; client will inject the created id
            "mode": "append",
            "sets": picked_sets,
        }
        proposals.append(
            AIProposal(
                intent="upsert_sets",
                payload=upsert_payload,
                summary=f"Add {len(picked_sets)} exercise group(s) to '{title}'.",
                confidence=0.75,
                requires_confirmation=True,
                requires_super_confirmation=False,
            )
        )

    return InterpretResponse(
        assistant_text=f"I can add **{title}** on {parsed_date}. Want me to queue that?",
        proposals=proposals,
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
