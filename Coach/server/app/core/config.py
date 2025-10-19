# server/app/core/config.py
import os
from dotenv import load_dotenv
from pydantic import BaseModel

# load .env from the server/ folder (Render sets real env vars; locally this reads server/.env)
load_dotenv()

class Settings(BaseModel):
    # database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./local.db")  # e.g. postgresql+psycopg://...neon.../neondb?sslmode=require

    # ai / llm
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini-1.5-pro")
    AI_MOCK: bool = os.getenv("AI_MOCK", "false").lower() == "true"

    # cors (optional: tighten later in prod)
    FRONTEND_ORIGINS: list[str] = (
        os.getenv("FRONTEND_ORIGINS", "*")
        .split(",")
        if os.getenv("FRONTEND_ORIGINS")
        else ["*"]
    )

settings = Settings()
