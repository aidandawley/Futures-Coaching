from datetime import datetime, date

from typing import List, Optional

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Column, Date, Boolean, DateTime, JSON, func, Index
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
    scheduled_for: Mapped[date | None] = mapped_column(nullable=True)
    status = Column(String, default="planned")
    
    user: Mapped["User"] = relationship(back_populates="workouts")
    sets: Mapped[List["ExerciseSet"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan"
    )

class ExerciseSet(Base):
    __tablename__ = "exercise_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workout_sessions.id"), index=True)

    exercise: Mapped[str] = mapped_column(String(100))
    reps: Mapped[int] = mapped_column(Integer)
    weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rpe: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    workout: Mapped["WorkoutSession"] = relationship(back_populates="sets")

class AITask(Base):
    __tablename__ = "ai_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    # mirrors AIProposal
    intent = Column(String(32), nullable=False)  # e.g. add_workout / move_workout ...
    payload = Column(JSON, nullable=False)
    summary = Column(String, default="")
    confidence = Column(Float, default=0.7)
    requires_confirmation = Column(Boolean, default=True)
    requires_super_confirmation = Column(Boolean, default=False)

    # queue state machine (no execution yet)
    status = Column(String(20), nullable=False, default="queued")  # queued|confirmed|executed|canceled

    # optional dedupe key if the UI resubmits the same thing
    dedupe_key = Column(String(64), nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

Index("ix_ai_tasks_user_status", AITask.user_id, AITask.status)