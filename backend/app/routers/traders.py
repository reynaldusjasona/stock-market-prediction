from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.services.trader_service import getApprovedTraders

router = APIRouter(prefix="/traders", tags=["Traders"])


@router.get("")
async def listTraders(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "investor":
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await getApprovedTraders()
    return {"traders": result}
