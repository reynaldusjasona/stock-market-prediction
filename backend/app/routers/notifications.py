from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.email import sendPendingEmailNotification as send_email
from app.core.security import get_current_user
from app.services import notification_service

router = APIRouter(prefix="/notifications")


@router.get("")
async def getNotifications(
    timeframe: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    return await notification_service.getNotifications(userID, None, timeframe)


@router.patch("/{notification_id}/read")
async def markAsRead(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    updated = await notification_service.markAsRead(
        notification_id, userID, None
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.post("/send-pending-email")
async def sendPendingEmailNotification(
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    await notification_service.sendPendingEmailNotification(
        userID, None, send_email
    )
    return {"sent": True}
