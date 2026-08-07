from datetime import datetime
from app.core.database import supabase
from ml.inference.predict import getMultiTimeframePredictions


def get_prediction(
    ticker: str, user_id: str = None, user_role: str = None
) -> dict:
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

    _insert_trader_signal_if_engaged(result, user_id, user_role)

    result["generated_at"] = datetime.utcnow().isoformat()
    return result


def _insert_trader_signal_if_engaged(
    result: dict, user_id: str, user_role: str
) -> None:
    """
    If the requesting investor has an active trader engagement, create a
    pending trader_signal row so their trader can review this prediction.
    Best-effort: any failure here must not affect the prediction response.
    """
    if not user_id or user_role != "investor":
        return
    try:
        engagement = (
            supabase.table("trader_clients")
            .select("trader_id")
            .eq("investor_id", user_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if not engagement.data:
            return
        trader_id = engagement.data[0]["trader_id"]

        # don't spam the trader with a new pending signal for the same
        # stock while one they haven't reviewed yet already exists
        existing = (
            supabase.table("trader_signal")
            .select("id")
            .eq("trader_id", trader_id)
            .eq("investor_id", user_id)
            .eq("ticker", result["ticker"])
            .is_("verdict", "null")
            .execute()
        )
        if existing.data:
            return

        supabase.table("trader_signal").insert({
            "trader_id": trader_id,
            "investor_id": user_id,
            "ticker": result["ticker"],
            "signal": result["signal"],
            "confidence_score": result.get("confidence"),
            "reasoning": result.get("reasoning"),
        }).execute()
    except Exception as exc:
        print(f"[trader_signal] auto-insert failed for {result.get('ticker')}: {exc}")


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
