from datetime import datetime
from app.core.database import supabase
from ml.inference.predict import getMultiTimeframePredictions


def get_prediction(ticker: str) -> dict:
    result = getMultiTimeframePredictions(ticker.upper())
    if "error" in result:
        return result

    # Only the 1d (base model) prediction is persisted as the
    # canonical row for this ticker/date - 3d/5d are derived from it
    # on the fly (see buildTimeframePredictions) and not stored as
    # separate rows, so history/recommendations keep one row per
    # ticker per day.
    supabase.table("predictions").upsert({
        "ticker": result["ticker"],
        "signal": result["signal"],
        "confidence_score": result["confidence"],
        "risk_level": result["risk_level"],
        "reasoning": result["reasoning"],
        "prediction_date": datetime.utcnow().date().isoformat(),
        "timeframe": "1d",
    }, on_conflict="ticker,prediction_date").execute()

    result["generated_at"] = datetime.utcnow().isoformat()
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
