# server/app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GEMINI_API_KEY: str | None = None
    AI_MODEL: str = "gemini-1.5-flash"
    AI_MOCK: bool = True

    # reads Coach/.env (relative to where you start uvicorn)
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

settings = Settings()
