from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services import alert_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])


class CreateAlertRequest(BaseModel):
    target_price: float
    condition: str


class UpdateAlertRequest(BaseModel):
    new_price: float
    alert_type: str


@router.get("/{ticker}")
async def getAlertForm(
    ticker: str,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    return await alert_service.getAlertForm(ticker, userID)


@router.post("/check/{ticker}")
async def detectAlertCondition(
    ticker: str,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    return await alert_service.detectAlertCondition(userID, ticker)


@router.post("/{ticker}", status_code=status.HTTP_201_CREATED)
async def createAlertsForm(
    ticker: str,
    body: CreateAlertRequest,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    try:
        return await alert_service.validateAndSaveAlert(ticker, body.target_price, body.condition, userID)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/{alert_id}")
async def updatePriceAlerts(
    alert_id: str,
    body: UpdateAlertRequest,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    try:
        return await alert_service.updatePriceAlerts(alert_id, body.new_price, body.alert_type, userID)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{alert_id}")
async def deletePriceAlert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    deleted = await alert_service.deletePriceAlert(alert_id, userID)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}
