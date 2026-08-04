from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from app.core.database import supabase

_VALID_ENDORSEMENTS = {"agree", "disagree"}


async def getTraderSignals(
    trader_id: str, ticker: Optional[str] = None, limit: int = 20
) -> list:
    query = (
        supabase.table("trader_signal")
        .select(
            "id, trader_id, investor_id, ticker, signal, confidence_score, "
            "reasoning, verdict, note, endorsed_at, created_at, "
            "investor:users!investor_id(name)"
        )
        .eq("trader_id", trader_id)
    )
    if ticker:
        query = query.eq("ticker", ticker.upper())
    result = query.order("created_at", desc=True).limit(limit).execute()
    rows = result.data or []

    signals = []
    for row in rows:
        investor = row.pop("investor", None) or {}
        row["investor_name"] = investor.get("name")
        signals.append(row)
    return signals


async def getTraderClients(trader_id: str) -> list:
    result = (
        supabase.table("trader_clients")
        .select("investor_id, status, created_at")
        .eq("trader_id", trader_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .execute()
    )
    links = result.data or []

    investorIDs = list({link["investor_id"] for link in links})
    userMap = {}
    if investorIDs:
        usersResult = (
            supabase.table("users")
            .select("id, name, email")
            .in_("id", investorIDs)
            .execute()
        )
        userMap = {u["id"]: u for u in (usersResult.data or [])}

    clients = []
    for link in links:
        user = userMap.get(link["investor_id"], {})
        clients.append(
            {
                "id": link["investor_id"],
                "full_name": user.get("name"),
                "email": user.get("email"),
                "linked_since": link.get("created_at"),
            }
        )
    return clients


async def getApprovedTraders() -> list:
    result = (
        supabase.table("users")
        .select("id, name, license_number, specialization, bio, years_experience")
        .eq("role", "trader")
        .eq("trader_status", "approved")
        .eq("status", "active")
        .order("name")
        .execute()
    )
    return result.data or []


async def endorseSignal(
    trader_id: str,
    signal_id: str,
    endorsement: str,
    notes: Optional[str] = None,
) -> dict:
    if endorsement not in _VALID_ENDORSEMENTS:
        raise HTTPException(
            status_code=400,
            detail="Endorsement must be 'agree' or 'disagree'",
        )

    signalResult = (
        supabase.table("trader_signal")
        .select("id")
        .eq("id", signal_id)
        .eq("trader_id", trader_id)
        .execute()
    )
    if not signalResult.data:
        raise HTTPException(status_code=404, detail="Signal not found")

    result = (
        supabase.table("trader_signal")
        .update({
            "verdict": endorsement,
            "note": notes,
            "endorsed_at": datetime.utcnow().isoformat(),
        })
        .eq("id", signal_id)
        .eq("trader_id", trader_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save endorsement")
    return result.data[0]


async def getTraderEndorsements(trader_id: str, limit: int = 20) -> list:
    result = (
        supabase.table("signal_endorsements")
        .select("id, prediction_id, endorsement, notes, created_at")
        .eq("trader_id", trader_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    endorsements = result.data or []

    predictionIDs = list({e["prediction_id"] for e in endorsements})
    predictionMap = {}
    if predictionIDs:
        predictionsResult = (
            supabase.table("predictions")
            .select("id, ticker, signal")
            .in_("id", predictionIDs)
            .execute()
        )
        predictionMap = {p["id"]: p for p in (predictionsResult.data or [])}

    items = []
    for e in endorsements:
        pred = predictionMap.get(e["prediction_id"], {})
        items.append(
            {
                "id": e["id"],
                "prediction_id": e["prediction_id"],
                "ticker": pred.get("ticker"),
                "predicted_action": pred.get("signal"),
                "endorsement": e.get("endorsement"),
                "notes": e.get("notes"),
                "created_at": e.get("created_at"),
            }
        )
    return items


async def getTraderStockInquiries(trader_id: str) -> list:
    """Get investor questions sent to this trader (from stock_inquiries,
    distinct from the AI-signal review flow in trader_signal)."""
    result = (
        supabase.table("stock_inquiries")
        .select(
            "id, investor_id, ticker, message, status, response, "
            "responded_at, created_at, investor:users!investor_id(name)"
        )
        .eq("trader_id", trader_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []

    inquiries = []
    for row in rows:
        investor = row.pop("investor", None) or {}
        row["investor_name"] = investor.get("name")
        inquiries.append(row)
    return inquiries


async def respondToStockInquiry(
    trader_id: str, inquiry_id: str, response: str
) -> dict:
    """Trader answers an investor's stock inquiry, notifying the investor."""
    existing = (
        supabase.table("stock_inquiries")
        .select("id, investor_id, ticker")
        .eq("id", inquiry_id)
        .eq("trader_id", trader_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Inquiry not found.")

    inquiry = existing.data[0]
    now = datetime.utcnow().isoformat()

    result = (
        supabase.table("stock_inquiries")
        .update({
            "response": response,
            "status": "answered",
            "responded_at": now,
        })
        .eq("id", inquiry_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save response")

    trader = (
        supabase.table("users").select("name").eq("id", trader_id).execute()
    )
    trader_name = trader.data[0].get("name") if trader.data else "Your trader"

    # same direct-insert pattern as alert_service.py - there's no shared
    # notification-creation helper in this codebase
    supabase.table("notifications").insert({
        "user_id": inquiry["investor_id"],
        "title": "Trader responded to your question",
        "message": (
            f"{trader_name} responded to your question about "
            f"{inquiry['ticker']}."
        ),
        "type": "stock_inquiry_response",
        "is_read": False,
        "email_sent": False,
    }).execute()

    return result.data[0]
