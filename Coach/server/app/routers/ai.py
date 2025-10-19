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
Scope = Literal["planning", "nutrition", "general"]  

SYSTEM_PROMPT = """
You are an AI strength coach embedded inside a workout planner app.

Tone & brevity
- Keep replies short (1–3 sentences). If you have enough info, also include a PLAN BLOCK.

What to output
- If you can infer name, date, and at least one workout from the user’s message, OUTPUT a PLAN BLOCK.
- If anything is missing, ask a very short follow-up question AND show the template so the user can fill it in quickly.

PLAN BLOCK format (exact)
<coach_plan>
name: <workout title>
date: YYYY-MM-DD
workouts:
1. <exercise> [optional reps/sets like 3x5 or "3 sets of 10"]
2. <exercise>
</coach_plan>

Rules
- If the user says push/pull/legs/upper/lower/full, use that for the name unless they provide a better title.
- When you can infer everything from natural language, don’t ask—just include the PLAN BLOCK.
- Never claim you change the calendar. You propose; the app applies after confirmation.
"""

NUTRITION_PROMPT = """
You are an AI nutrition coach inside a food logging app.

Tone & brevity
- Be concise (1–3 sentences). Friendly, non-judgmental, practical, professional.

What to output
- If user shares entries/macros or a goal, give specific tips (protein targets, fiber, hydration, meal timing).
- If info is missing, ask one tiny clarifying question.
- Never claim you changed logs or goals. You only suggest; the app updates when the user does.
-If the user ever asks to update the logs tell them that you aren't designed to input logs and they must manaully do so
-If the user asks for workout or training advice advise it to return to the workout planning section to get advice (there is a tailored ai agent there for training)

Patterns to use sparingly
- If asked for a plan: provide a short bullet list
- If user wants a swap: suggest 1–2 equivalent options with grams and rough kcal.

Safety
- Avoid medical diagnoses and say you are only able to give advice. For medical concerns, suggest consulting a professional.
"""
class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: Optional[int] = None
    scope: Optional[Scope] = "planning"

class ChatReply(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str

PROMPTS: dict[str, str] = {
    "planning": SYSTEM_PROMPT,
    "nutrition": NUTRITION_PROMPT,
}
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
    scope = (req.scope or "planning").lower()
    system_prompt = PROMPTS.get(scope, SYSTEM_PROMPT)

    if settings.AI_MOCK or not settings.GEMINI_API_KEY:
        return ChatReply(content=_mock_reply(req.messages, scope))

    try:
        messages = [{"role": "system", "content": system_prompt}]
        messages += [m.model_dump() for m in req.messages]
        content = chat_with_gemini(messages, settings.GEMINI_API_KEY, settings.AI_MODEL)
        return ChatReply(content=content)
    except Exception as e:
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
    Hybrid interpreter:
    - Prefer a structured <coach_plan>...</coach_plan> block (from user or assistant).
    - Otherwise, parse natural language to extract name, date, and exercises.
    - If something essential is missing, ask for the template.
    """
    # --------------------------
    # Collect text
    # --------------------------
    all_msgs = [m.content for m in req.messages]  # include user and assistant
    user_msgs = [m.content for m in req.messages if m.role == "user"]
    last_user = user_msgs[-1] if user_msgs else ""
    full_text = "\n".join(all_msgs)
    lu_last = last_user.lower()
    lu_full = full_text.lower()

    # --------------------------
    # Utilities
    # --------------------------
    PLAN_TEMPLATE = (
        "<coach_plan>\n"
        "name: <workout title>\n"
        "date: YYYY-MM-DD\n"
        "workouts:\n"
        "1. <exercise>\n"
        "2. <exercise>\n"
        "</coach_plan>"
    )

    def _safe_date(y: int, m: int, d: int) -> Optional[str]:
        try:
            return date(y, m, d).isoformat()
        except ValueError:
            return None

    def _iso_from_any(s: str) -> Optional[str]:
        s = s.strip()
        # yyyy-mm-dd or yyyy/mm/dd
        m = re.match(r"^\s*(\d{4})[-/](\d{2})[-/](\d{2})\s*$", s)
        if m:
            y, mm, dd = map(int, m.groups())
            return _safe_date(y, mm, dd)
        # mm-dd-yyyy or mm/dd/[yy|yyyy]
        m = re.match(r"^\s*(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\s*$", s)
        if m:
            mm, dd, yy = m.groups()
            mm, dd = int(mm), int(dd)
            yy = int(yy)
            if yy < 100:
                yy += 2000
            return _safe_date(yy, mm, dd)
        return None

    def _extract_plan_block(text: str) -> Optional[str]:
        blocks = re.findall(r"<coach_plan>(.*?)</coach_plan>", text, flags=re.I | re.S)
        return blocks[-1] if blocks else None

    def _parse_plan_block(block: str) -> dict:
        s = block.replace("\r\n", "\n")

        m = re.search(r"(?im)^\s*name\s*:\s*(.+)\s*$", s)
        name = m.group(1).strip() if m else None

        m = re.search(r"(?im)^\s*date\s*:\s*(.+?)\s*$", s)
        iso_date = _iso_from_any(m.group(1)) if m else None

        items: list[str] = []
        after = re.split(r"(?im)^\s*workouts\s*:\s*$", s, maxsplit=1)
        search_region = after[1] if len(after) == 2 else s
        for line in search_region.split("\n"):
            mnum = re.match(r"^\s*\d+[\.)]\s*(.+?)\s*$", line)
            if mnum:
                txt = mnum.group(1).strip()
                if txt:
                    items.append(txt)

        return {"name": name, "iso_date": iso_date, "items": items}

    # Extract structured plan if present (from user or assistant)
    block = _extract_plan_block(full_text)
    if block:
        parsed = _parse_plan_block(block)
        missing = []
        if not parsed["name"]:
            missing.append("name")
        if not parsed["iso_date"]:
            missing.append("date")
        if not parsed["items"]:
            missing.append("at least one workout")
        if missing:
            return InterpretResponse(
                assistant_text=(
                    "Looks close! Missing "
                    + ", ".join(missing)
                    + ". Please resend using this:\n" + PLAN_TEMPLATE
                ),
                proposals=[],
            )

        title = parsed["name"]
        iso_date = parsed["iso_date"]
        items = parsed["items"]

    else:
        # --------------------------
        # Parse natural language
        # --------------------------
        # Date: prefer last mentioned date in the whole convo
        iso_date: Optional[str] = None
        # yyyy-mm-dd or yyyy/mm/dd
        for m in re.finditer(r"\b(\d{4})[-/](\d{2})[-/](\d{2})\b", lu_full):
            y, mm, dd = map(int, m.groups())
            iso = _safe_date(y, mm, dd)
            if iso:
                iso_date = iso  # last wins
        # mm-dd-yyyy or mm/dd/[yy|yyyy]
        for m in re.finditer(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b", lu_full):
            mm, dd, yy = m.groups()
            mm, dd = int(mm), int(dd); yy = int(yy)
            if yy < 100: yy += 2000
            iso = _safe_date(yy, mm, dd)
            if iso:
                iso_date = iso  # last wins
        if not iso_date and "tomorrow" in lu_last:
            iso_date = (date.today() + timedelta(days=1)).isoformat()
        if not iso_date and "today" in lu_last:
            iso_date = date.today().isoformat()

        # Title from common splits or “call it …”
        title = "Workout"
        if re.search(r"\bpull\b", lu_last) or re.search(r"\bpull\b", lu_full):
            title = "Pull Day"
        elif re.search(r"\bpush\b", lu_last) or re.search(r"\bpush\b", lu_full):
            title = "Push Day"
        elif re.search(r"\bleg(s)?\b", lu_last) or re.search(r"\bleg(s)?\b", lu_full):
            title = "Leg Day"
        elif re.search(r"\bupper\b", lu_full):
            title = "Upper Day"
        elif re.search(r"\blower\b", lu_full):
            title = "Lower Day"
        m = re.search(r"(call it|name it|title it)\s+([^\n.,;]+)", last_user, flags=re.I)
        if m:
            custom = m.group(2).strip()
            if custom:
                title = custom

        # Exercises (canonical names + aliases)
        CANONICAL = {
            "bench press": [r"\bbench( press)?\b"],
            "incline dumbbell press": [r"\bincline( dumbbell)? press\b", r"\bincline\b"],
            "overhead press": [r"\bohp\b", r"\boverhead press\b", r"\bshoulder press\b"],
            "lateral raise": [r"\blateral raise(s)?\b"],
            "barbell row": [r"\bbarbell row(s)?\b", r"\brows?\b"],
            "dumbbell row": [r"\bdumbbell row(s)?\b"],
            "lat pulldown": [r"\blat pull ?down(s)?\b", r"\bpull ?down(s)?\b", r"\bpulldown(s)?\b"],
            "curl": [r"\bcurl(s)?\b", r"\bbiceps?\b"],
            "triceps pushdown": [r"\b(triceps )?pushdown(s)?\b"],
            "squat": [r"\bsquat(s)?\b"],
            "deadlift": [r"\bdeadlift(s)?\b"],
            "dip": [r"\bdip(s)?\b"],
        }

        found: list[str] = []
        for name, pats in CANONICAL.items():
            for pat in pats:
                if re.search(pat, lu_full, flags=re.I):
                    found.append(name); break

        # Defaults if user implied a split
        if not found and "pull" in lu_full:
            found = ["lat pulldown", "barbell row", "curl"]
        if not found and "push" in lu_full:
            found = ["bench press", "overhead press", "lateral raise"]
        if not found and re.search(r"\bleg(s)?\b", lu_full):
            found = ["squat", "deadlift"]

        items = found

        # Need essentials?
        missing = []
        if not iso_date:
            missing.append("date")
        if not items:
            missing.append("at least one workout")
        if missing:
            return InterpretResponse(
                assistant_text=(
                    "I can do that—please confirm the missing field(s): "
                    + ", ".join(missing)
                    + ". You can also paste this:\n" + PLAN_TEMPLATE
                ),
                proposals=[],
            )

    # --------------------------
    # Build proposals
    # --------------------------
    add_payload = AddWorkoutPayload(date=iso_date, title=title, notes="").model_dump()
    add_prop = AIProposal(
        intent="add_workout",
        payload=add_payload,
        summary=f"Add '{title}' on {iso_date}.",
        confidence=0.9,
        requires_confirmation=True,
        requires_super_confirmation=False,
    )

    # upsert_sets with defaults when reps/sets not given
    def _parse_sets_spec(item: str) -> tuple[str, Optional[int], Optional[int]]:
        t = item.strip()
        m = re.search(r"(\d+)\s*[xX]\s*(\d+)", t)
        if m:
            a, b = map(int, m.groups())
            sets, reps = (a, b) if a <= 8 else (b, a)
            ex = re.sub(r"\d+\s*[xX]\s*\d+", "", t).strip(" -–—")
            return ex or t, int(reps), int(sets)
        m = re.search(r"(\d+)\s*sets?\s*of\s*(\d+)", t, flags=re.I)
        if m:
            sets, reps = map(int, m.groups())
            ex = re.sub(r"(\d+)\s*sets?\s*of\s*(\d+)", "", t, flags=re.I).strip(" -–—")
            return ex or t, int(reps), int(sets)
        return t, None, None

    sets_payload = []
    for raw in items:
        ex, reps, sets_ct = _parse_sets_spec(raw)
        sets_payload.append(
            {
                "exercise": ex,
                "reps": int(reps) if reps is not None else 8,
                "weight": None,
                "count": int(sets_ct) if sets_ct is not None else 3,
            }
        )

    proposals = [add_prop]
    if sets_payload:
        proposals.append(
            AIProposal(
                intent="upsert_sets",
                payload={"workout_id": 0, "mode": "append", "sets": sets_payload},
                summary=f"Add {len(sets_payload)} exercise group(s) to '{title}'.",
                confidence=0.9,
                requires_confirmation=True,
                requires_super_confirmation=False,
            )
        )

    return InterpretResponse(
        assistant_text=f"I can add **{title}** on {iso_date}. Want me to queue that?",
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
