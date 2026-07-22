from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services import investor_service


router = APIRouter(prefix="/investor", tags=["Investor"])


def _require_investor(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "investor":
        raise HTTPException(status_code=403, detail="Investor access only.")
    return current_user


class EngageTraderRequest(BaseModel):
    trader_id: str


@router.get("/traders")
async def listTraders(current_user: dict = Depends(_require_investor)):
    return await investor_service.listApprovedTraders(current_user["sub"])


@router.get("/trader-signals")
async def getTraderSignals(
    trader_id: Optional[str] = None,
    current_user: dict = Depends(_require_investor),
):
    return await investor_service.getTraderSignals(
        current_user["sub"], trader_id
    )


@router.post("/engagements")
async def engageTrader(
    body: EngageTraderRequest,
    current_user: dict = Depends(_require_investor),
):
    return await investor_service.engageTrader(
        current_user["sub"], body.trader_id
    )


@router.get("/engagements/me")
async def getOwnEngagement(
    current_user: dict = Depends(_require_investor),
):
    return await investor_service.getOwnEngagement(current_user["sub"])


@router.delete("/engagements/{engagement_id}")
async def endEngagement(
    engagement_id: str,
    current_user: dict = Depends(_require_investor),
):
    return await investor_service.endEngagement(
        current_user["sub"], engagement_id
    )
