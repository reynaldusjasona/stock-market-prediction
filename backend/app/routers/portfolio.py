from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services import portfolio_service

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


class AddHoldingRequest(BaseModel):
    ticker: str
    shares: float
    average_buy_price: float


@router.get("")
async def getPortfolio(
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    return await portfolio_service.getPortfolio(userID)


@router.get("/{ticker}")
async def getHoldingDetail(
    ticker: str,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    try:
        return await portfolio_service.getHoldingDetail(userID, ticker)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("", status_code=status.HTTP_201_CREATED)
async def addHolding(
    body: AddHoldingRequest,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    try:
        return await portfolio_service.addHolding(
            userID, body.ticker, body.shares, body.average_buy_price
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{ticker}")
async def removeHolding(
    ticker: str,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    deleted = await portfolio_service.removeHolding(userID, ticker)
    if not deleted:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"success": True}
