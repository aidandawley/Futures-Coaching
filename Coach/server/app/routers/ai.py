from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from ..core.config import settings
from ..services.ai_client import chat_with_gemini

router = APIRouter(prefix="/ai", tags=["AI"])

Role = Literal["system", "user", "assistant"]

class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1)

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: Optional[int] = None

class ChatReply(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str

def _mock_reply(messages: List[ChatMessage]) -> str:
    last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
    if "plan" in last_user.lower():
        return "cool — tell me your goal and how many days/week, and i’ll draft a plan."
    if "bench" in last_user.lower():
        return "try 3×5 at an rpe 7–8; add 2.5–5 lb next week if all reps move well."
    return "got it! what do you want to work on — strength, hypertrophy, or general fitness?"

@router.post("/chat", response_model=ChatReply)
async def chat(req: ChatRequest):
    # mock path
    if settings.AI_MOCK or not settings.GEMINI_API_KEY:
        return ChatReply(content=_mock_reply(req.messages))

    try:
        content = chat_with_gemini(
            [m.model_dump() for m in req.messages],
            settings.GEMINI_API_KEY,
            settings.AI_MODEL,
        )
        return ChatReply(content=content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"gemini error: {e}")

@router.get("/models")
def list_models():
    import google.generativeai as genai
    from ..core.config import settings

    genai.configure(api_key=settings.GEMINI_API_KEY)
    out = []
    for m in genai.list_models():
        if "generateContent" in getattr(m, "supported_generation_methods", []):
            out.append(m.name)  # e.g. "models/gemini-1.5-flash" or "models/gemini-1.5-flash-002"
    return {"models": out}
