from datetime import datetime
from typing import List, Optional

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    workouts: Mapped[List["WorkoutSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # e.g., “Push day”, “Legs”, etc.
    title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    user: Mapped["User"] = relationship(back_populates="workouts")
    sets: Mapped[List["ExerciseSet"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan"
    )

class ExerciseSet(Base):
    __tablename__ = "exercise_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workout_sessions.id"), index=True)

    # Basic exercise info (we can normalize later)
    exercise: Mapped[str] = mapped_column(String(100))        # e.g., “Bench Press”
    reps: Mapped[int] = mapped_column(Integer)
    weight: Mapped[float] = mapped_column(Float)              # store as kg or lb (frontend can label)
    rpe: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    workout: Mapped["WorkoutSession"] = relationship(back_populates="sets")
