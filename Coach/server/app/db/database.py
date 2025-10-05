from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from typing import Generator

# --- Paths ---
BASE_DIR = Path(__file__).resolve().parent.parent  # .../server/app
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "app.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# --- SQLAlchemy core ---
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite + threads (uvicorn reload)
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

# --- FastAPI dependency to get a DB session per request ---
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
