from typing import Optional
from pydantic import BaseModel

class SetBase(BaseModel):
    exercise: str
    reps: int
    weight: float
    rpe: Optional[float] = None

class SetCreate(SetBase):
    workout_id: int

class SetRead(SetBase):
    id: int
    workout_id: int

    class Config:
        from_attributes = True
