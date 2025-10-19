# server/app/routers/workouts.py

# ── stdlib ─────────────────────────────────────────────────────────────────────
from datetime import date

# ── third-party ────────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

# ── local ─────────────────────────────────────────────────────────────────────
from ..db import models
from ..db.database import get_db
from ..schemas.workout import WorkoutCreate, WorkoutRead, WorkoutWithSets

router = APIRouter(prefix="/workouts", tags=["Workouts"])

# small patch schema for partial updates (title/notes/status/scheduled_for)
class WorkoutPatch(BaseModel):
    title: str | None = None
    notes: str | None = None
    status: str | None = None           # e.g. "planned" | "done" | "rest"
    scheduled_for: date | None = None   # YYYY-MM-DD


# create a workout
@router.post("/", response_model=WorkoutRead)
def create_workout(workout: WorkoutCreate, db: Session = Depends(get_db)):
    # ensure the FK exists, otherwise return a clean 400
    user = db.get(models.User, workout.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid user_id: user does not exist")

    new_workout = models.WorkoutSession(**workout.dict())
    db.add(new_workout)
    db.commit()
    db.refresh(new_workout)
    return new_workout


# list all workouts (admin/dev convenience)
@router.get("/", response_model=list[WorkoutRead])
def list_workouts(db: Session = Depends(get_db)):
    return db.query(models.WorkoutSession).all()

# list workouts by user (recent first)
@router.get("/by_user/{user_id}", response_model=list[WorkoutRead])
def list_workouts_by_user(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.WorkoutSession)
        .filter(models.WorkoutSession.user_id == user_id)
        .order_by(models.WorkoutSession.started_at.desc())
        .all()
    )

# get a single workout with sets
@router.get("/{workout_id}/detail", response_model=WorkoutWithSets)
def get_workout_detail(workout_id: int, db: Session = Depends(get_db)):
    # use session.get (sa 1.4+/2.0) instead of legacy query(...).get(...)
    workout = db.get(models.WorkoutSession, workout_id)
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout

# list all workouts (with sets) for a user (recent first)
@router.get("/by_user/{user_id}/with_sets", response_model=list[WorkoutWithSets])
def list_user_workouts_with_sets(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.WorkoutSession)
        .options(joinedload(models.WorkoutSession.sets))
        .filter(models.WorkoutSession.user_id == user_id)
        .order_by(models.WorkoutSession.started_at.desc())
        .all()
    )

# list workouts in a date range (inclusive), minimal fields
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

# list workouts on a specific day
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

# list workouts in a date range (inclusive) with sets joined
@router.get("/by_user/{user_id}/range_with_sets", response_model=list[WorkoutWithSets])
def list_workouts_in_range_with_sets(
    user_id: int,
    start: date = Query(..., description="YYYY-MM-DD"),
    end: date = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.WorkoutSession)
        .options(joinedload(models.WorkoutSession.sets))
        .filter(models.WorkoutSession.user_id == user_id)
        .filter(models.WorkoutSession.scheduled_for >= start)
        .filter(models.WorkoutSession.scheduled_for <= end)
        .order_by(models.WorkoutSession.scheduled_for.asc())
        .all()
    )

# patch a workout (supports trailing slash too)
# - lets the tracker mark "done", change title/notes, or move the day
@router.patch("/{workout_id}", response_model=WorkoutRead)
@router.patch("/{workout_id}/", response_model=WorkoutRead)
def update_workout(
    workout_id: int = Path(..., ge=1),
    patch: WorkoutPatch = None,
    db: Session = Depends(get_db),
):
    w = db.get(models.WorkoutSession, workout_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")

    changed = False
    if patch:
        if patch.title is not None:
            w.title = patch.title; changed = True
        if patch.notes is not None:
            w.notes = patch.notes; changed = True
        if patch.status is not None:
            w.status = patch.status; changed = True
        if patch.scheduled_for is not None:
            w.scheduled_for = patch.scheduled_for; changed = True

    if changed:
        db.add(w)
        db.commit()
        db.refresh(w)

    return w


# delete a workout (and its sets) by id
@router.delete("/{workout_id}", status_code=204)
def delete_workout(
    workout_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    # fetch the workout
    w = db.query(models.WorkoutSession).get(workout_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")

    try:
        db.query(models.Set).filter(models.Set.workout_id == workout_id).delete(synchronize_session=False)
    except Exception:
        pass

    db.delete(w)
    db.commit()
    return Response(status_code=204)
