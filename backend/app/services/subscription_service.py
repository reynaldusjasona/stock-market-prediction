import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from dotenv import load_dotenv
from fastapi import HTTPException

from app.core.database import supabase
from app.services.activity_service import logActivity

load_dotenv()

_STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
_STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
_STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
_STRIPE_INVESTOR_PRICE_ID = os.getenv(
    "STRIPE_INVESTOR_PRICE_ID", _STRIPE_PRICE_ID
)
_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

if _STRIPE_SECRET_KEY:
    stripe.api_key = _STRIPE_SECRET_KEY

PLANS = [
    {
        "id": "investor",
        "name": "Investor Plan",
        "price": 29.99,
        "currency": "usd",
        "interval": "month",
        "features": [
            "AI-powered stock predictions",
            "Real-time market data",
            "News & sentiment analysis",
            "Price alerts & notifications",
            "Watchlist & portfolio tracking",
            "Personalized recommendations",
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


async def createCheckoutSession(userID: str, email: str, role: str) -> dict:
    if role == "trader":
        raise HTTPException(
            status_code=400,
            detail="Traders have free access and do not require a subscription.",
        )
    if role == "admin":
        raise HTTPException(
            status_code=400,
            detail="Admin accounts do not require a subscription.",
        )

    if not _STRIPE_SECRET_KEY:
        return {
            "checkout_url": (
                f"{_FRONTEND_URL}/subscription"
                "?status=success&session_id=mock_session"
            )
        }

    price_id = _STRIPE_INVESTOR_PRICE_ID
    plan_name = "investor"

    if not price_id:
        raise HTTPException(
            status_code=500,
            detail="Stripe price not configured for this role",
        )

    success_url = (
        f"{_FRONTEND_URL}/subscription"
        "?status=success&session_id={CHECKOUT_SESSION_ID}"
    )
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=f"{_FRONTEND_URL}/subscription?status=cancelled",
        client_reference_id=userID,
        customer_email=email,
        metadata={"user_id": userID, "plan": plan_name},
    )
    return {"checkout_url": session.url}


async def _activateSubscriptionFromWebhook(userID: str, plan: str) -> None:
    try:
        await createSubscription(userID, plan)
    except ValueError:
        return
    await logActivity(
        userID=str(userID),
        action="subscription_activated_webhook",
        targetType="subscription",
    )


async def handleWebhookEvent(
    payload: bytes, sig_header: Optional[str]
) -> dict:
    if _STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, _STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError) as exc:
            raise ValueError(str(exc))
    else:
        event = json.loads(payload)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        userID = session["client_reference_id"]
        try:
            plan = session["metadata"]["plan"]
        except (KeyError, TypeError):
            plan = "premium"
        if userID:
            await _activateSubscriptionFromWebhook(userID, plan)

    return {"status": "ok"}
