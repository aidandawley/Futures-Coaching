from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import models
from ..db.database import get_db
from ..schemas.set import SetCreate, SetRead, SetUpdate, SetBulkCreate


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

@router.get("/{set_id}", response_model=SetRead)
def get_set(set_id: int, db: Session = Depends(get_db)):
    db_set = db.query(models.ExerciseSet).get(set_id)
    if not db_set:
        raise HTTPException(status_code=404, detail="Set not found")
    return db_set  

@router.patch("/{set_id}", response_model=SetRead)
def update_set(set_id: int, payload: SetUpdate, db: Session = Depends(get_db)):
    db_set = db.query(models.ExerciseSet).get(set_id)
    if not db_set:
        raise HTTPException(status_code=404, detail="Set not found")

    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(db_set, field, value)

    db.commit()
    db.refresh(db_set)
    return db_set



@router.delete("/{set_id}", status_code=204)
def delete_set(set_id: int, db: Session = Depends(get_db)):
    db_set = db.query(models.ExerciseSet).get(set_id)
    if not db_set:
        raise HTTPException(status_code=404, detail="Set not found")
    db.delete(db_set)
    db.commit()
    return  # 204 No Content


@router.post("/bulk", response_model=list[SetRead])
def create_sets_bulk(payload: SetBulkCreate, db: Session = Depends(get_db)):
    if payload.count < 1 or payload.count > 100:
        raise HTTPException(status_code=400, detail="count must be between 1 and 100")

    workout = db.query(models.WorkoutSession).get(payload.workout_id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")

    made = []
    for _ in range(payload.count):
        row = models.ExerciseSet(
            workout_id=payload.workout_id,
            exercise=payload.exercise,
            reps=payload.reps,
            weight=payload.weight,  # may be None
        )
        db.add(row)
        made.append(row)

    db.commit()
    for r in made:
        db.refresh(r)
    return made