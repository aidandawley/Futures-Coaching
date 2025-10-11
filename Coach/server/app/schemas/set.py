from typing import Optional
from pydantic import BaseModel

# shared fields for a set
class SetBase(BaseModel):
    exercise: str
    reps: int
    # weight is optional so users can leave it blank
    weight: Optional[float] = None

# create a single set
class SetCreate(SetBase):
    workout_id: int

# read a set
class SetRead(SetBase):
    id: int
    workout_id: int
    class Config:
        from_attributes = True  # pydantic v2

# patch/update a set
class SetUpdate(BaseModel):
    exercise: Optional[str] = None
    reps: Optional[int] = None
    weight: Optional[float] = None

# NEW: bulk create N sets for one exercise
class SetBulkCreate(BaseModel):
    workout_id: int
    exercise: str
    reps: int
    count: int               # how many sets to create
    weight: Optional[float] = None
