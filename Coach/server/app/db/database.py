from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# read env/config (Neon URL etc.)
from ..core.config import settings

# --- paths (only used for the local SQLite fallback) ---
BASE_DIR = Path(__file__).resolve().parent.parent  # .../server/app
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "app.db"

# pick DB url: prefer env (Neon), else local sqlite
DATABASE_URL = settings.DATABASE_URL or f"sqlite:///{DB_PATH}"

# --- engine config: sqlite needs special connect_args; others use pool_pre_ping ---
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

# FastAPI dependency: one DB session per request
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
