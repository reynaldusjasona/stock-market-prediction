from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user
from app.services.stock_service import (
    calculateIndicators,
    fetchPriceData,
    fetchStockList,
    fetchTrendingTickers,
    getOrderBook as svcGetOrderBook,
    getPriceHistory as svcGetPriceHistory,
    getLivePrice as svcGetLivePrice,
    getTopGainersandLosers as svcGetTopGainersandLosers,
    queryStockDB,
)

router = APIRouter()

# ---- STATIC ROUTES FIRST (must precede /{ticker} to avoid shadowing) ----


@router.get("/stocks/trending", tags=["Stocks"])
async def trending():
    return await fetchTrendingTickers()


@router.get("/stocks/search", tags=["Stocks"])
async def search(
    q: str = Query(..., description="Ticker symbol or company name"),
):
    return await queryStockDB(q)


@router.get("/stocks/movers", tags=["Stocks"])
async def getTopGainersandLosers():
    result = await svcGetTopGainersandLosers()
    if not result.get("gainers") and not result.get("losers"):
        raise HTTPException(status_code=404, detail="No mover data available")
    return result


@router.get("/stocks", tags=["Stocks"])
async def getStocks():
    return await fetchStockList()


# ---- DYNAMIC ROUTES (ticker param) ----

@router.get("/stocks/{ticker}/indicators", tags=["Stocks"])
async def indicators(ticker: str):
    price_history = await svcGetPriceHistory(ticker)
    return await calculateIndicators(price_history)


@router.get("/stocks/{ticker}/chart", tags=["Stocks"])
async def getStockChart(
    ticker: str,
    _user: dict = Depends(get_current_user),
):
    history = await svcGetPriceHistory(ticker)
    live = await svcGetLivePrice(ticker)
    if not history and not live:
        raise HTTPException(
            status_code=404,
            detail=f"No chart data available for {ticker}",
        )
    return {"ticker": ticker.upper(), "history": history, "live": live}


@router.get("/stocks/{ticker}/history", tags=["Stocks"])
async def getPriceHistory(ticker: str):
    return await svcGetPriceHistory(ticker)


@router.get("/stocks/{ticker}/price", tags=["Stocks"])
async def getLivePrice(ticker: str):
    return await svcGetLivePrice(ticker)


@router.get("/stocks/{ticker}/orderbook", tags=["Stocks"])
async def getOrderBook(
    ticker: str,
    _user: dict = Depends(get_current_user),
):
    return await svcGetOrderBook(ticker)


@router.get("/stocks/{ticker}", tags=["Stocks"])
async def getStockByTicker(ticker: str):
    return await fetchPriceData(ticker.upper())
