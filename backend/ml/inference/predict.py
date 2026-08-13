import functools

import pandas as pd

from ml.training.evaluate import load_model
from ml.training.features import _FEATURE_COLS, calculate_indicators, fetch_stock_data

# We only have one trained model (next-day direction). 3d/5d are not
# independent forecasts from separate models - they reuse the 1d
# signal and scale confidence down to reflect the extra uncertainty of
# a longer horizon. This is a heuristic placeholder agreed on by the
# team, not a statistically calibrated per-horizon prediction.
_TIMEFRAME_CONFIDENCE_SCALARS = {
    "1d": 1.0,
    "3d": 0.85,
    "5d": 0.75,
}


def _risk_level_for_confidence(confidence: float) -> str:
    if confidence >= 75:
        return "Low Risk"
    elif confidence >= 50:
        return "Moderate Risk"
    return "High Risk"


def buildTimeframePredictions(signal: str, confidence: float) -> list:
    """
    Expand a single next-day signal/confidence into 1d/3d/5d variants
    by scaling confidence per _TIMEFRAME_CONFIDENCE_SCALARS. Signal
    stays the same across timeframes; only confidence (and the
    risk_level derived from it) changes.
    """
    predictions = []
    for timeframe, scalar in _TIMEFRAME_CONFIDENCE_SCALARS.items():
        scaledConfidence = round(confidence * scalar, 2)
        predictions.append({
            "timeframe": timeframe,
            "signal": signal,
            "confidence": scaledConfidence,
            "risk_level": _risk_level_for_confidence(scaledConfidence),
        })
    return predictions


def get_latest_features(
    ticker: str,
    start: str = "2020-01-01",
    end: str = "2025-12-31",
) -> pd.DataFrame:
    """
    Fetch the most recent feature row for a ticker.

    Downloads OHLCV data via fetch_stock_data, computes all technical
    indicators via calculate_indicators (the same function and column set
    used by the training pipeline), and returns only the final row as a
    single-row DataFrame with the _FEATURE_COLS columns.

    Raises ValueError if the processed DataFrame is empty (e.g. insufficient
    historical data to compute rolling windows).
    """
    raw = fetch_stock_data(ticker)
    processed = calculate_indicators(raw, ticker=ticker, start=start, end=end)

    if processed.empty:
        raise ValueError(
            f"No feature data available for ticker '{ticker}'. "
            "The ticker may be invalid or have insufficient history."
        )

    return processed[_FEATURE_COLS].iloc[[-1]]


@functools.lru_cache(maxsize=1)
def _get_explainer():
    """
    Build a SHAP TreeExplainer around the cached model instance.

    Cached in memory after the first call so repeated predictions don't
    rebuild the explainer on every request.
    """
    import shap
    model, _ = load_model()
    return shap.TreeExplainer(model)


def getPrediction(ticker: str) -> dict:
    """
    Generate a Buy / Hold / Sell signal for a single ticker.

    Loads the saved XGBClassifier and LabelEncoder from disk, fetches the
    latest feature row for the ticker, runs inference, and returns a
    structured prediction result.

    The confidence score is the maximum class probability expressed as a
    percentage. Risk level is derived from that score:
      >= 75  → "Low Risk"
      50–74  → "Moderate Risk"
      < 50   → "High Risk"

    Returns a dict with keys: ticker, signal, confidence,
    risk_level, reasoning.
    """
    try:
        model, label_encoder = load_model()
    except (FileNotFoundError, OSError) as exc:
        print(f"Error loading model artifacts: {exc}")
        return {"error": "Model not yet trained. Run training pipeline first."}

    features = get_latest_features(ticker)

    pred_enc = model.predict(features)[0]
    proba = model.predict_proba(features)[0]

    signal = label_encoder.inverse_transform([pred_enc])[0]
    confidence = round(float(proba.max()) * 100, 2)
    risk_level = _risk_level_for_confidence(confidence)

    try:
        explainer = _get_explainer()
        shapValues = explainer.shap_values(features)

        if isinstance(shapValues, list):
            classShapValues = shapValues[pred_enc][0]
            baseValue = float(explainer.expected_value[pred_enc])
        else:
            classShapValues = shapValues[0]
            baseValue = float(explainer.expected_value)

        impacts = sorted(
            zip(features.columns, classShapValues),
            key=lambda pair: abs(pair[1]),
            reverse=True,
        )[:10]
        shapExplanation = [
            {"feature": featureName, "impact": float(impactValue)}
            for featureName, impactValue in impacts
        ]
    except Exception as exc:
        print(f"Error computing SHAP explanation for {ticker}: {exc}")
        shapExplanation = []
        baseValue = None

    row = features.iloc[0]
    reasoning = (
        f"RSI14 is {row['RSI14']:.1f}. "
        f"MACD is {row['MACD']:.4f}. "
        f"Model confidence is {confidence:.1f}%."
    )

    return {
        "ticker": ticker.upper(),
        "signal": signal,
        "confidence": confidence,
        "risk_level": risk_level,
        "reasoning": reasoning,
        "shapExplanation": shapExplanation,
        "baseValue": baseValue,
    }


def getMultiTimeframePredictions(ticker: str) -> dict:
    """
    Same single-model prediction as getPrediction(), plus a
    "predictions" list with 1d/3d/5d variants (see
    buildTimeframePredictions). Existing top-level keys (ticker,
    signal, confidence, risk_level, reasoning) are unchanged, so
    callers that only read those keep working.
    """
    base = getPrediction(ticker)
    if "error" in base:
        return base

    return {
        **base,
        "predictions": buildTimeframePredictions(
            base["signal"], base["confidence"]
        ),
    }


if __name__ == "__main__":
    result = getMultiTimeframePredictions("AAPL")
    print(result)
