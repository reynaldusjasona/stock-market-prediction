from datetime import datetime
from app.core.database import supabase
from ml.inference.predict import getPrediction


def get_prediction(ticker: str) -> dict:
    result = getPrediction(ticker.upper())
    supabase.table("predictions").upsert({
        "ticker": result["ticker"],
        "signal": result["signal"],
        "confidence_score": result["confidence"],
        "risk_level": result["risk_level"],
        "reasoning": result["reasoning"],
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
