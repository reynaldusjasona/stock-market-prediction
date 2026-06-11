from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user
from ml.prediction_service import get_prediction, get_prediction_history

router = APIRouter()


# ---- STATIC-STYLE ROUTES FIRST ----
# (specific paths before /{ticker} param routes)

@router.get("/predictions/{ticker}/history", tags=["Predictions"])
async def predictionHistory(
    ticker: str,
    limit: int = Query(default=10, le=50),
    _user: dict = Depends(get_current_user),
):
    # Return the last {limit} prediction records for the ticker,
    # most recent first
    return get_prediction_history(ticker.upper(), limit)


@router.get("/predictions/{ticker}/recommendation", tags=["Predictions"])
async def getStockRecommendations(
    ticker: str,
    _user: dict = Depends(get_current_user),
):
    # Return a simplified signal summary without reasoning or extra metadata
    try:
        result = get_prediction(ticker.upper())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Recommendation failed",
        )
    return {
        "ticker": result["ticker"],
        "signal": result["signal"],
        "risk_level": result["risk_level"],
        "confidence": result["confidence"],
    }


# ---- BASE TICKER ROUTE (must come after specific sub-paths) ----

@router.get("/predictions/{ticker}", tags=["Predictions"])
async def predict(
    ticker: str,
    _user: dict = Depends(get_current_user),
):
    # Run the ML model and return the full prediction result, persisted to DB
    try:
        return get_prediction(ticker.upper())
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except Exception:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prediction failed",
        )
