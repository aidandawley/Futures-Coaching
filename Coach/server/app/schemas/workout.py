from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class WorkoutBase(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None

class WorkoutCreate(WorkoutBase):
    user_id: int

class WorkoutRead(WorkoutBase):
    id: int
    user_id: int
    started_at: datetime

    class Config:
        from_attributes = True

from typing import List
from .set import SetRead  # add this import

class WorkoutWithSets(WorkoutRead):
    sets: List[SetRead] = []