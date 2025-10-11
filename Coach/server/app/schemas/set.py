from typing import Optional
from pydantic import BaseModel

class SetBase(BaseModel):
    exercise: str
    reps: int
    weight: Optional[float] = None  

class SetCreate(SetBase):
    workout_id: int

class SetRead(SetBase):
    id: int
    workout_id: int
    class Config:
        from_attributes = True

class SetUpdate(BaseModel):
    exercise: Optional[str] = None
    reps: Optional[int] = None
    weight: Optional[float] = None
