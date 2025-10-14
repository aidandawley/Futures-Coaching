from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ----- Allowed intents (first pass) -----
IntentAdd       = Literal["add_workout"]
IntentMove      = Literal["move_workout"]
IntentEdit      = Literal["edit_workout"]
IntentUpsert    = Literal["upsert_sets"]
IntentDelete    = Literal["delete_workout"]
IntentBulkPlan  = Literal["bulk_plan"]

AnyIntent = Literal[
    "add_workout",
    "move_workout",
    "edit_workout",
    "upsert_sets",
    "delete_workout",
    "bulk_plan",
]


# ================= Payload models (strict, minimal first pass) =================

class AddWorkoutPayload(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # ISO date
    title: str = Field(min_length=1)
    notes: Optional[str] = ""


class MoveWorkoutPayload(BaseModel):
    workout_id: int
    new_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class EditWorkoutPayload(BaseModel):
    workout_id: int
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[Literal["planned", "done", "rest"]] = None


class SetSpec(BaseModel):
    exercise: str
    reps: int = Field(ge=1, le=100)
    weight: Optional[float] = None
    count: int = Field(ge=1, le=50)


class UpsertSetsPayload(BaseModel):
    workout_id: int
    mode: Literal["append", "replace"] = "append"
    sets: List[SetSpec]


class DeleteWorkoutPayload(BaseModel):
    workout_id: int
    reason: Optional[str] = None  # for audit


class BulkPlanDay(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    title: str
    notes: Optional[str] = ""


class BulkPlanPayload(BaseModel):
    days: List[BulkPlanDay] = Field(min_length=1, max_length=14)


# ================= Proposal (what AI suggests; NO side effects) ================

class AIProposal(BaseModel):
    """
    A single proposed change. Backend will validate before showing to the user.
    NOTE: This is *not* executed here—only displayed for confirmation later.
    """
    intent: AnyIntent
    payload: dict
    summary: str = ""
    confidence: float = Field(ge=0.0, le=1.0, default=0.7)
    requires_confirmation: bool = True
    requires_super_confirmation: bool = False  # True for risky ops like delete/replace

    @field_validator("payload")
    @classmethod
    def _validate_payload(cls, v, info):
        """Lightweight server-side validation so bad payloads don't reach execution."""
        intent = info.data.get("intent")
        try:
            if intent == "add_workout":
                AddWorkoutPayload(**v)
            elif intent == "move_workout":
                MoveWorkoutPayload(**v)
            elif intent == "edit_workout":
                EditWorkoutPayload(**v)
            elif intent == "upsert_sets":
                UpsertSetsPayload(**v)
            elif intent == "delete_workout":
                DeleteWorkoutPayload(**v)
            elif intent == "bulk_plan":
                BulkPlanPayload(**v)
        except Exception as e:
            raise ValueError(f"Invalid payload for intent '{intent}': {e}")
        return v


class InterpretResponse(BaseModel):
    assistant_text: str
    proposals: List[AIProposal] = []


# ===================== Task queue (what we actually store) =====================

class AITaskCreate(BaseModel):
    user_id: int
    intent: str
    payload: dict
    summary: str = ""
    confidence: float = 0.7
    requires_confirmation: bool = True
    requires_super_confirmation: bool = False
    dedupe_key: Optional[str] = None


class AITaskOut(BaseModel):
    id: int
    user_id: int
    intent: str
    payload: dict
    summary: str
    confidence: float
    requires_confirmation: bool
    requires_super_confirmation: bool
    status: str
    dedupe_key: Optional[str] = None
    created_at: datetime 
    updated_at: datetime   

    # Allow ORM objects (SQLAlchemy models) to be parsed directly
    model_config = {"from_attributes": True}