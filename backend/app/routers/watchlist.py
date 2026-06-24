from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.services import watchlist_service

router = APIRouter(prefix="/watchlist", tags=["Watchlist"])


@router.get("")
async def getWatchlist(
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    return await watchlist_service.getWatchlist(userID)


@router.post("/{ticker}", status_code=status.HTTP_201_CREATED)
async def addToWatchlist(
    ticker: str,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    try:
        return await watchlist_service.addToWatchlist(userID, ticker)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.delete("/{ticker}")
async def removeFromWatchlist(
    ticker: str,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    deleted = await watchlist_service.removeFromWatchlist(userID, ticker)
    if not deleted:
        raise HTTPException(status_code=404, detail="Ticker not found in watchlist")
    return {"success": True}
