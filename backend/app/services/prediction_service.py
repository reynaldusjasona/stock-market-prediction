from fastapi import HTTPException

from app.services.stock_service import getLiveStockData
from ml.inference.predict import getPrediction


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

    price = live.get("current_price", "N/A") if isinstance(live, dict) else "N/A"
    change_percent = (
        live.get("change_percent", "N/A") if isinstance(live, dict) else "N/A"
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
