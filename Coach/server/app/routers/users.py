from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import models
from ..db.database import get_db
from ..schemas.user import UserCreate, UserRead
router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserRead)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    new_user = models.User(username=user.username)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()
