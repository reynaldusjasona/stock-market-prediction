from datetime import datetime, timezone

from app.core.database import supabase


async def getPortfolio(userID: str) -> list:
    result = (
        supabase.table("portfolio")
        .select("*")
        .eq("user_id", userID)
        .execute()
    )
    return result.data or []


async def getHoldingDetail(userID: str, ticker: str) -> dict:
    result = (
        supabase.table("portfolio")
        .select("*")
        .eq("user_id", userID)
        .eq("ticker", ticker)
        .execute()
    )
    if not result.data:
        raise LookupError("Holding not found")
    return result.data[0]


async def addHolding(
    userID: str, ticker: str, shares: float, average_buy_price: float
) -> dict:
    if shares <= 0 or average_buy_price <= 0:
        raise ValueError("shares and average_buy_price must be greater than 0")

    existing = (
        supabase.table("portfolio")
        .select("*")
        .eq("user_id", userID)
        .eq("ticker", ticker)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        existing_shares = row["shares"]
        existing_avg = row["average_buy_price"]
        new_shares = existing_shares + shares
        new_avg = ((existing_shares * existing_avg) + (shares * average_buy_price)) / new_shares

        result = (
            supabase.table("portfolio")
            .update({
                "shares": new_shares,
                "average_buy_price": new_avg,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("user_id", userID)
            .eq("ticker", ticker)
            .execute()
        )
    else:
        result = (
            supabase.table("portfolio")
            .insert({
                "user_id": userID,
                "ticker": ticker,
                "shares": shares,
                "average_buy_price": average_buy_price,
            })
            .execute()
        )

    return result.data[0]


async def removeHolding(userID: str, ticker: str) -> bool:
    result = (
        supabase.table("portfolio")
        .delete()
        .eq("user_id", userID)
        .eq("ticker", ticker)
        .execute()
    )
    return bool(result.data)
