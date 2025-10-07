from datetime import datetime, date
from pydantic import BaseModel
from typing import Optional, List
from fastapi import Query


class WorkoutBase(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    scheduled_for: Optional[date] = None
class WorkoutCreate(WorkoutBase):
    user_id: int

class WorkoutRead(WorkoutBase):
    id: int
    user_id: int
    started_at: datetime

    class Config:
        from_attributes = True

from .set import SetRead  # add this import

class WorkoutWithSets(WorkoutRead):
    sets: List[SetRead] = []