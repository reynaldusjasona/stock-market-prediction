from app.core.database import supabase


async def getWatchlist(userID: str) -> list:
    result = (
        supabase.table("watchlist")
        .select("*")
        .eq("user_id", userID)
        .execute()
    )
    return result.data or []


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
