import json
from datetime import datetime

from fastapi import HTTPException

from app.core.database import supabase
from app.services.stock_service import getLiveStockData
from ml.inference.predict import getPrediction


def get_prediction(ticker: str) -> dict:
    result = getPrediction(ticker.upper())
    supabase.table("predictions").upsert({
        "ticker": result["ticker"],
        "signal": result["signal"],
        "confidence_score": result["confidence"],
        "risk_level": result["risk_level"],
        "reasoning": result["reasoning"],
        "contributions": json.dumps(result["contributions"]),
        "prediction_date": datetime.utcnow().date().isoformat(),
    }, on_conflict="ticker,prediction_date").execute()

    return result


def get_prediction_history(ticker: str, limit: int = 10) -> list[dict]:
    response = (
        supabase.table("predictions")
        .select("*")
        .eq("ticker", ticker.upper())
        .order("prediction_date", desc=True)
        .limit(limit)
        .execute()
    )
    rows = response.data if response.data else []
    for row in rows:
        row["confidence"] = row.get("confidence_score")
    return rows


async def getRecommendationDetails(stock: str) -> dict:
    try:
        result = getPrediction(stock.upper())
    except Exception:
        result = None

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Recommendation details unavailable for {stock}",
        )

    live = await getLiveStockData(stock.upper())

    price = (
        live.get("current_price", "N/A") if isinstance(live, dict)
        else "N/A"
    )
    change_percent = (
        live.get("change_percent", "N/A") if isinstance(live, dict)
        else "N/A"
    )
    confidence_score = result["confidence"]

    reasoning = (
        f"Current price is {price} with {change_percent}% change today. "
        f"Model confidence is {confidence_score}%."
    )

    return {
        "ticker": stock.upper(),
        "signal": result["signal"],
        "confidence_score": confidence_score,
        "risk_level": result["risk_level"],
        "reasoning": reasoning,
        "live": live,
    }
