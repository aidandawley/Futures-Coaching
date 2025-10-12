from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from ..core.config import settings

router = APIRouter(prefix="/ai", tags=["AI"])

# --- schemas ---
Role = Literal["system", "user", "assistant"]

class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1)

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: Optional[int] = None  # optional for now

class ChatReply(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str

# --- helpers (mock) ---
def _mock_reply(messages: List[ChatMessage]) -> str:
    last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
    if "plan" in last_user.lower():
        return "cool — tell me your goal and how many days/week, and I’ll draft a plan."
    if "bench" in last_user.lower():
        return "try 3×5 at an RPE 7–8; add 2.5–5 lb next week if all reps move well."
    return "got it! what do you want to work on — strength, hypertrophy, or general fitness?"

# --- routes ---
@router.post("/chat", response_model=ChatReply)
async def chat(req: ChatRequest):
    # mock mode
    if settings.AI_MOCK or not settings.GEMINI_API_KEY:
        return ChatReply(content=_mock_reply(req.messages))

    # real model (will implement next steps)
    raise HTTPException(status_code=501, detail="ai is not enabled yet")
