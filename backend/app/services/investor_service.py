from typing import Optional

from fastapi import HTTPException

from app.core.database import supabase


async def _check_signal_access(user_id: str) -> None:
    """Verify investor has active subscription with signal access."""
    result = (
        supabase.table("subscriptions")
        .select("has_signal_access")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    if not result.data or not result.data[0].get("has_signal_access"):
        raise HTTPException(
            status_code=403,
            detail="Subscribe to Signal Access ($19.99/mo) to view trader recommendations.",
        )


async def listApprovedTraders(user_id: str) -> dict:
    """List all approved traders with basic info."""
    await _check_signal_access(user_id)
    result = (
        supabase.table("users")
        .select("id, name, email, license_number, created_at")
        .eq("role", "trader")
        .eq("trader_status", "approved")
        .execute()
    )
    return {"traders": result.data or []}


async def getTraderSignals(user_id: str, trader_id: Optional[str] = None) -> dict:
    """Get endorsed signals from traders."""
    await _check_signal_access(user_id)
    query = supabase.table("signal_endorsements").select("*")
    if trader_id:
        query = query.eq("trader_id", trader_id)
    result = query.order("created_at", desc=True).limit(50).execute()
    return {"signals": result.data or []}


async def engageTrader(investor_id: str, trader_id: str) -> dict:
    """Investor engages a trader (creates trader_clients row)."""
    await _check_signal_access(investor_id)
    trader = (
        supabase.table("users")
        .select("id")
        .eq("id", trader_id)
        .eq("role", "trader")
        .eq("trader_status", "approved")
        .execute()
    )
    if not trader.data:
        raise HTTPException(status_code=404, detail="Trader not found.")

    existing = (
        supabase.table("trader_clients")
        .select("id")
        .eq("trader_id", trader_id)
        .eq("investor_id", investor_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409, detail="Already engaged with this trader."
        )

    result = (
        supabase.table("trader_clients")
        .insert({
            "trader_id": trader_id,
            "investor_id": investor_id,
            "status": "active",
        })
        .execute()
    )
    return {
        "message": "Trader engaged successfully",
        "engagement": result.data[0] if result.data else None,
    }


async def getOwnEngagement(investor_id: str) -> dict:
    """Get investor's current trader engagements."""
    await _check_signal_access(investor_id)
    result = (
        supabase.table("trader_clients")
        .select("*")
        .eq("investor_id", investor_id)
        .eq("status", "active")
        .execute()
    )
    links = result.data or []

    traderIDs = list({link["trader_id"] for link in links})
    traderMap = {}
    if traderIDs:
        tradersResult = (
            supabase.table("users")
            .select("id, name, email, license_number")
            .in_("id", traderIDs)
            .execute()
        )
        traderMap = {t["id"]: t for t in (tradersResult.data or [])}

    engagements = []
    for link in links:
        engagements.append({
            **link,
            "trader": traderMap.get(link["trader_id"]),
        })
    return {"engagements": engagements}


async def endEngagement(investor_id: str, engagement_id: str) -> dict:
    """End an engagement with a trader."""
    await _check_signal_access(investor_id)
    existing = (
        supabase.table("trader_clients")
        .select("*")
        .eq("id", engagement_id)
        .eq("investor_id", investor_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Engagement not found.")

    supabase.table("trader_clients").update(
        {"status": "inactive"}
    ).eq("id", engagement_id).execute()
    return {"message": "Engagement ended."}
