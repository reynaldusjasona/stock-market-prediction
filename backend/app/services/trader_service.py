from typing import Optional

from fastapi import HTTPException

from app.core.database import supabase

_VALID_ENDORSEMENTS = {"agree", "disagree"}


async def getTraderSignals(
    trader_id: str, ticker: Optional[str] = None, limit: int = 20
) -> list:
    query = supabase.table("predictions").select(
        "id, ticker, signal, confidence_score, prediction_date"
    )
    if ticker:
        query = query.eq("ticker", ticker.upper())
    result = query.order("prediction_date", desc=True).limit(limit).execute()
    predictions = result.data or []

    tickers = list({p["ticker"] for p in predictions if p.get("ticker")})
    stockMap = {}
    if tickers:
        stocksResult = (
            supabase.table("stocks")
            .select("ticker, company_name")
            .in_("ticker", tickers)
            .execute()
        )
        stockMap = {s["ticker"]: s for s in (stocksResult.data or [])}

    return [
        {
            "id": p["id"],
            "ticker": p["ticker"],
            "company_name": stockMap.get(p["ticker"], {}).get("company_name"),
            "predicted_action": p.get("signal"),
            "confidence_score": p.get("confidence_score"),
            "prediction_date": p.get("prediction_date"),
        }
        for p in predictions
    ]


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


async def endorseSignal(
    trader_id: str,
    prediction_id: str,
    endorsement: str,
    notes: Optional[str] = None,
) -> dict:
    if endorsement not in _VALID_ENDORSEMENTS:
        raise HTTPException(
            status_code=400,
            detail="Endorsement must be 'agree' or 'disagree'",
        )

    predictionResult = (
        supabase.table("predictions")
        .select("id")
        .eq("id", prediction_id)
        .execute()
    )
    if not predictionResult.data:
        raise HTTPException(status_code=404, detail="Prediction not found")

    result = (
        supabase.table("signal_endorsements")
        .upsert(
            {
                "trader_id": trader_id,
                "prediction_id": prediction_id,
                "endorsement": endorsement,
                "notes": notes,
            },
            on_conflict="trader_id,prediction_id",
        )
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
