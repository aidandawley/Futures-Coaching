# server/app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import models
from ..db.database import get_db
from ..schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", response_model=UserRead)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    u = models.User(**user.model_dump())  # if on pydantic v1, use user.dict()
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.post("/ensure", response_model=UserRead)
def ensure_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Idempotent: return the existing user with this username,
    or create one if it doesn't exist.
    """
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        return existing

    u = models.User(**user.model_dump())  
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.get("/", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u
