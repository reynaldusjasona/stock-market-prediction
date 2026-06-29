from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.services import feedback_service

router = APIRouter()

_VALID_STATUSES = {"pending", "approved", "rejected"}


class FeedbackCreate(BaseModel):
    subject: str = Field(max_length=255)
    message: str = Field(min_length=1)


@router.post("", status_code=status.HTTP_201_CREATED)
async def createFeedback(
    body: FeedbackCreate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "investor":
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        return await feedback_service.createFeedback(
            current_user["sub"], body.subject, body.message
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("")
async def listFeedback(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    if status is not None and status not in _VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="status must be one of: pending, approved, rejected",
        )
    return await feedback_service.getAllFeedback(status, page, limit)


@router.patch("/{feedback_id}/approve")
async def approveFeedback(
    feedback_id: str,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await feedback_service.updateFeedbackStatus(feedback_id, "approved")
    if result is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result


@router.patch("/{feedback_id}/reject")
async def rejectFeedback(
    feedback_id: str,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await feedback_service.updateFeedbackStatus(feedback_id, "rejected")
    if result is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result
