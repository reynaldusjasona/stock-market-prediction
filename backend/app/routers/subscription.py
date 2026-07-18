from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services import subscription_service
from app.services.activity_service import logActivity

router = APIRouter(prefix="/subscription", tags=["Subscription"])
admin_router = APIRouter(prefix="/admin/subscriptions", tags=["Admin"])


class SubscribeRequest(BaseModel):
    plan: str


@router.get("/plans")
async def getPlans():
    return subscription_service.PLANS


@router.get("")
async def getSubscription(
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    return await subscription_service.getSubscription(userID)


@router.post("", status_code=status.HTTP_201_CREATED)
async def createSubscription(
    body: SubscribeRequest,
    current_user: dict = Depends(get_current_user),
):
    if body.plan != "premium":
        raise HTTPException(
            status_code=400, detail="Invalid plan. Only 'premium' is available."
        )
    userID = current_user["sub"]
    try:
        result = await subscription_service.createSubscription(userID, body.plan)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    await logActivity(
        userID=str(userID),
        action="subscription_activated",
        targetType="subscription",
    )
    return result


@router.post("/cancel")
async def cancelSubscription(
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    try:
        return await subscription_service.cancelSubscription(userID)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/checkout")
async def createCheckoutSession(
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    email = current_user.get("email", "")
    role = current_user.get("role", "investor")
    return await subscription_service.createCheckoutSession(
        userID, email, role
    )


@router.post("/webhook")
async def stripeWebhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        return await subscription_service.handleWebhookEvent(payload, sig_header)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@admin_router.get("")
async def getAllSubscriptions(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return await subscription_service.getAllSubscriptions(status)
