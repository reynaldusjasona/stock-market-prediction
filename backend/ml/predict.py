import pandas as pd

from ml.evaluate import load_model
from ml.features import calculate_indicators, fetch_stock_data

_FEATURE_COLS = [
    "Open", "High", "Low", "Close", "Volume",
    "SMA20", "EMA20", "RSI14", "MACD", "MACD_Signal",
    "BB_Upper", "BB_Lower", "BB_Width",
    "Return_1D", "Return_5D", "Return_10D",
    "Volatility_10D", "Volume_Ratio",
    "Dist_SMA20", "Dist_EMA20",
]


def get_latest_features(ticker: str) -> pd.DataFrame:
    """
    Fetch the most recent feature row for a ticker.

    Downloads OHLCV data via fetch_stock_data, computes all technical
    indicators via calculate_indicators, drops the Label column (not needed
    for inference), and returns only the final row as a single-row DataFrame
    with the 13 feature columns.

    Raises ValueError if the processed DataFrame is empty (e.g. insufficient
    historical data to compute rolling windows).
    """
    raw = fetch_stock_data(ticker)
    processed = calculate_indicators(raw)

    processed = processed.drop(columns=["Label"])

    if processed.empty:
        raise ValueError(
            f"No feature data available for ticker '{ticker}'. "
            "The ticker may be invalid or have insufficient history."
        )

    return processed[_FEATURE_COLS].iloc[[-1]]


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
    model, label_encoder = load_model()
    features = get_latest_features(ticker)

    pred_enc = model.predict(features)[0]
    proba = model.predict_proba(features)[0]

    signal = label_encoder.inverse_transform([pred_enc])[0]
    confidence = round(float(proba.max()) * 100, 2)

    if confidence >= 75:
        risk_level = "Low Risk"
    elif confidence >= 50:
        risk_level = "Moderate Risk"
    else:
        risk_level = "High Risk"

    row = features.iloc[0]
    reasoning = (
        f"RSI14 is {row['RSI14']:.1f}. "
        f"MACD is {row['MACD']:.4f}. "
        f"SMA20 is {row['SMA20']:.2f}. "
        f"Model confidence is {confidence:.1f}%."
    )

    return {
        "ticker": ticker.upper(),
        "signal": signal,
        "confidence": confidence,
        "risk_level": risk_level,
        "reasoning": reasoning,
    }


if __name__ == "__main__":
    result = getPrediction("AAPL")
    print(result)
