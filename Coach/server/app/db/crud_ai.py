from sqlalchemy.orm import Session
from typing import List, Optional
from . import models

def create_ai_task(
    db: Session,
    *,
    user_id: int,
    intent: str,
    payload: dict,
    summary: str = "",
    confidence: float = 0.7,
    requires_confirmation: bool = True,
    requires_super_confirmation: bool = False,
    dedupe_key: Optional[str] = None,
):
    task = models.AITask(
        user_id=user_id,
        intent=intent,
        payload=payload,
        summary=summary,
        confidence=confidence,
        requires_confirmation=requires_confirmation,
        requires_super_confirmation=requires_super_confirmation,
        status="queued",
        dedupe_key=dedupe_key,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

def list_ai_tasks(db: Session, *, user_id: int, status: Optional[str] = None) -> List[models.AITask]:
    q = db.query(models.AITask).filter(models.AITask.user_id == user_id)
    if status:
        q = q.filter(models.AITask.status == status)
    return q.order_by(models.AITask.created_at.desc()).all()
