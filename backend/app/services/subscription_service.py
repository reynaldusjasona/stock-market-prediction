import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from dotenv import load_dotenv

from app.core.database import supabase

load_dotenv()

_STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
_STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
_STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

if _STRIPE_SECRET_KEY:
    stripe.api_key = _STRIPE_SECRET_KEY

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


async def createCheckoutSession(userID: str, email: str) -> dict:
    if not _STRIPE_SECRET_KEY:
        return {
            "checkout_url": f"{_FRONTEND_URL}/subscription?status=success&session_id=mock_session"
        }

    success_url = (
        f"{_FRONTEND_URL}/subscription?status=success&session_id={{CHECKOUT_SESSION_ID}}"
    )
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": _STRIPE_PRICE_ID, "quantity": 1}],
        success_url=success_url,
        cancel_url=f"{_FRONTEND_URL}/subscription?status=cancelled",
        client_reference_id=userID,
        customer_email=email,
    )
    return {"checkout_url": session.url}


async def _activateSubscriptionFromWebhook(userID: str) -> None:
    try:
        await createSubscription(userID, "premium")
    except ValueError:
        pass


async def handleWebhookEvent(payload: bytes, sig_header: Optional[str]) -> dict:
    if _STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, _STRIPE_WEBHOOK_SECRET)
        except (ValueError, stripe.error.SignatureVerificationError) as exc:
            raise ValueError(str(exc))
    else:
        event = json.loads(payload)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        userID = session.get("client_reference_id")
        if userID:
            await _activateSubscriptionFromWebhook(userID)

    return {"status": "ok"}
