from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import models
from ..db.database import get_db
from ..schemas.workout import WorkoutCreate, WorkoutRead
from ..schemas.workout import WorkoutCreate, WorkoutRead, WorkoutWithSets 
from sqlalchemy.orm import Session, joinedload 
from fastapi import Query

from datetime import date

router = APIRouter(prefix="/workouts", tags=["Workouts"])

@router.post("/", response_model=WorkoutRead)
def create_workout(workout: WorkoutCreate, db: Session = Depends(get_db)):
    new_workout = models.WorkoutSession(**workout.dict())
    db.add(new_workout)
    db.commit()
    db.refresh(new_workout)
    return new_workout

@router.get("/", response_model=list[WorkoutRead])
def list_workouts(db: Session = Depends(get_db)):
    return db.query(models.WorkoutSession).all()

@router.get("/by_user/{user_id}", response_model=list[WorkoutRead])
def list_workouts_by_user(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.user_id == user_id)
        .order_by(models.WorkoutSession.started_at.desc())
        .all()
    )



@router.get("/{workout_id}/detail", response_model=WorkoutWithSets)
def get_workout_detail(workout_id: int, db: Session = Depends(get_db)):
    workout = db.query(models.WorkoutSession).get(workout_id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    return workout

@router.get("/by_user/{user_id}/with_sets", response_model=list[WorkoutWithSets])
def list_user_workouts_with_sets(user_id: int, db: Session = Depends(get_db)):
   
    return (
        db.query(models.WorkoutSession)
        .options(joinedload(models.WorkoutSession.sets))
        .filter(models.WorkoutSession.user_id == user_id)
        .order_by(models.WorkoutSession.started_at.desc())
        .all()
    )

@router.get("/by_user/{user_id}/range", response_model=list[WorkoutRead])
def list_workouts_in_range(
    user_id: int,
    start: date = Query(..., description="YYYY-MM-DD"),
    end: date = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.user_id == user_id)
        .filter(models.WorkoutSession.scheduled_for >= start)
        .filter(models.WorkoutSession.scheduled_for <= end)
        .order_by(models.WorkoutSession.scheduled_for.asc())
        .all()
    )

@router.get("/by_user/{user_id}/on/{day}", response_model=list[WorkoutRead])
def list_workouts_on_day(
    user_id: int,
    day: date,
    db: Session = Depends(get_db),
):
    return (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.user_id == user_id)
        .filter(models.WorkoutSession.scheduled_for == day)
        .order_by(models.WorkoutSession.started_at.asc())
        .all()
    )