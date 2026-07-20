import asyncio

from app.core.database import supabase
from app.services.stock_service import fetchPriceData


async def getWatchlist(userID: str) -> list:
    result = (
        supabase.table("watchlist")
        .select("*")
        .eq("user_id", userID)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return []

    tickers = [row["ticker"] for row in rows]
    stocks_result = (
        supabase.table("stocks")
        .select("ticker, company_name")
        .in_("ticker", tickers)
        .execute()
    )
    company_names = {
        s["ticker"]: s.get("company_name", "") for s in (stocks_result.data or [])
    }
    price_results = await asyncio.gather(
        *[fetchPriceData(ticker) for ticker in tickers],
        return_exceptions=True,
    )

    enriched = []
    for row, price in zip(rows, price_results):
        ticker = row["ticker"]
        current_price = None
        change_percent = None
        if isinstance(price, dict) and "error" not in price:
            current_price = price.get("current_price")
            change_percent = price.get("change_percent")
        enriched.append({
            **row,
            "company_name": company_names.get(ticker, ""),
            "current_price": current_price,
            "change_percent": change_percent,
        })
    return enriched


async def addToWatchlist(userID: str, ticker: str) -> dict:
    existing = (
        supabase.table("watchlist")
        .select("id")
        .eq("user_id", userID)
        .eq("ticker", ticker)
        .execute()
    )
    if existing.data:
        raise ValueError("Ticker already in watchlist")

    result = (
        supabase.table("watchlist")
        .insert({"user_id": userID, "ticker": ticker})
        .execute()
    )
    return result.data[0]


async def removeFromWatchlist(userID: str, ticker: str) -> bool:
    result = (
        supabase.table("watchlist")
        .delete()
        .eq("user_id", userID)
        .eq("ticker", ticker)
        .execute()
    )
    return bool(result.data)
