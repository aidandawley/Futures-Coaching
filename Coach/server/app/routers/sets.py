from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import models
from db.database import get_db
from schemas.set import SetCreate, SetRead

router = APIRouter(prefix="/sets", tags=["Sets"])

@router.post("/", response_model=SetRead)
def create_set(payload: SetCreate, db: Session = Depends(get_db)):
    # ensure workout exists
    workout = db.query(models.WorkoutSession).get(payload.workout_id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    new_set = models.ExerciseSet(**payload.dict())
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return new_set

@router.get("/", response_model=list[SetRead])
def list_sets(db: Session = Depends(get_db)):
    return db.query(models.ExerciseSet).all()

@router.get("/by_workout/{workout_id}", response_model=list[SetRead])
def list_sets_by_workout(workout_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.ExerciseSet)
        .filter(models.ExerciseSet.workout_id == workout_id)
        .all()
    )
