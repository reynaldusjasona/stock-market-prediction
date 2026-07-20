from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.database import supabase
from app.core.security import get_current_user
from app.services.trader_service import (
    endorseSignal,
    getTraderClients,
    getTraderEndorsements,
    getTraderSignals,
)

router = APIRouter(prefix="/trader", tags=["Trader"])


class EndorseSignalRequest(BaseModel):
    prediction_id: str
    endorsement: str
    notes: Optional[str] = None


async def require_approved_trader(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if current_user.get("role") != "trader":
        raise HTTPException(status_code=403, detail="Trader access required")
    result = (
        supabase.table("users")
        .select("trader_status")
        .eq("id", current_user["sub"])
        .execute()
    )
    if not result.data or result.data[0].get("trader_status") != "approved":
        raise HTTPException(
            status_code=403, detail="Trader account pending approval"
        )
    return current_user


@router.get("/signals")
async def getSignals(
    ticker: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(require_approved_trader),
):
    result = await getTraderSignals(current_user["sub"], ticker, limit)
    return {"signals": result}


@router.post("/signals/endorse")
async def endorseSignalRoute(
    body: EndorseSignalRequest,
    current_user: dict = Depends(require_approved_trader),
):
    result = await endorseSignal(
        current_user["sub"], body.prediction_id, body.endorsement, body.notes
    )
    return {"endorsement": result}


@router.get("/clients")
async def getClients(
    current_user: dict = Depends(require_approved_trader),
):
    result = await getTraderClients(current_user["sub"])
    return {"clients": result}


@router.get("/endorsements")
async def getEndorsements(
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(require_approved_trader),
):
    result = await getTraderEndorsements(current_user["sub"], limit)
    return {"endorsements": result}
