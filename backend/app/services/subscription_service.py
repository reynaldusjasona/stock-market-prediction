from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.database import supabase

PLANS = [
    {
        "plan": "premium",
        "price": "9.99",
        "currency": "USD",
        "period": "monthly",
        "features": [
            "AI Stock Predictions",
            "Sentiment Analysis",
            "Portfolio Tracking",
            "Price Alerts",
            "Personalized Recommendations",
        ],
    }
]


async def getSubscription(userID: str) -> Optional[dict]:
    result = (
        supabase.table("subscriptions")
        .select("*")
        .eq("user_id", userID)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def createSubscription(userID: str, plan: str) -> dict:
    existing = (
        supabase.table("subscriptions")
        .select("id")
        .eq("user_id", userID)
        .eq("status", "active")
        .execute()
    )
    if existing.data:
        raise ValueError("Already subscribed")

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=30)

    result = (
        supabase.table("subscriptions")
        .insert({
            "user_id": userID,
            "plan": plan,
            "status": "active",
            "started_at": now.isoformat(),
            "expires_at": expires.isoformat(),
        })
        .execute()
    )
    return result.data[0]


async def cancelSubscription(userID: str) -> dict:
    existing = (
        supabase.table("subscriptions")
        .select("id")
        .eq("user_id", userID)
        .eq("status", "active")
        .execute()
    )
    if not existing.data:
        raise LookupError("No active subscription")

    subscription_id = existing.data[0]["id"]
    now = datetime.now(timezone.utc)

    result = (
        supabase.table("subscriptions")
        .update({
            "status": "cancelled",
            "cancelled_at": now.isoformat(),
            "updated_at": now.isoformat(),
        })
        .eq("id", subscription_id)
        .execute()
    )
    return result.data[0]


async def getAllSubscriptions(status_filter: Optional[str] = None) -> list:
    query = supabase.table("subscriptions").select("*, users(name, email)")
    if status_filter:
        query = query.eq("status", status_filter)
    result = query.execute()
    return result.data or []
