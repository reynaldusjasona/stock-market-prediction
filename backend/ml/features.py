import numpy as np
import pandas as pd
import yfinance as yf


def fetch_stock_data(
    ticker: str, start: str = "2020-01-01", end: str = "2025-12-31"
) -> pd.DataFrame:
    """
    Download daily OHLCV data for a ticker using yfinance.

    Drops any rows where Open, High, Low, Close, or Volume is NaN,
    then sorts the result by date ascending.

    Returns a DataFrame with columns: Open, High, Low, Close, Volume.
    """
    raw = yf.download(
        ticker, start=start, end=end,
        auto_adjust=True, progress=False,
    )

    # yfinance may return a MultiIndex when multiple tickers are
    # used; flatten here
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    df = raw[["Open", "High", "Low", "Close", "Volume"]].copy()
    df = df.drop_duplicates()
    df = df.ffill()
    df.dropna(subset=["Open", "High", "Low", "Close", "Volume"], inplace=True)
    df.sort_index(inplace=True)
    return df


def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add 8 technical indicators and a Label column to a raw OHLCV DataFrame.

    Indicators calculated with pure pandas (no ta-lib):
      SMA20        — 20-day simple moving average of Close
      EMA20        — 20-day exponential moving average of Close
      RSI14        — 14-day RSI using Wilder's smoothing (ewm with alpha=1/14)
      MACD         — EMA12 - EMA26 of Close
      MACD_Signal  — 9-day EMA of MACD line
      BB_Upper     — SMA20 + 2 * 20-day rolling std of Close
      BB_Lower     — SMA20 - 2 * 20-day rolling std of Close
      BB_Width     — BB_Upper - BB_Lower

    Label is derived from the next trading day's Close vs current Close:
      Buy   — next close > current close by more than 2%
      Sell  — next close < current close by more than 2%
      Hold  — change within ±2%

    Rows with NaN (due to rolling windows or shift) are dropped.

    Returns a DataFrame with 14 columns in this order:
    Open, High, Low, Close, Volume, SMA20, EMA20, RSI14, MACD,
    MACD_Signal, BB_Upper, BB_Lower, BB_Width, Label
    """
    out = df.copy()

    # SMA20
    out["SMA20"] = out["Close"].rolling(window=20).mean()

    # EMA20
    out["EMA20"] = out["Close"].ewm(span=20, adjust=False).mean()

    # RSI14 using Wilder's smoothing
    delta = out["Close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out["RSI14"] = 100 - (100 / (1 + rs))

    # MACD and Signal
    ema12 = out["Close"].ewm(span=12, adjust=False).mean()
    ema26 = out["Close"].ewm(span=26, adjust=False).mean()
    out["MACD"] = ema12 - ema26
    out["MACD_Signal"] = out["MACD"].ewm(span=9, adjust=False).mean()

    # Bollinger Bands
    rolling_std = out["Close"].rolling(window=20).std()
    out["BB_Upper"] = out["SMA20"] + 2 * rolling_std
    out["BB_Lower"] = out["SMA20"] - 2 * rolling_std
    out["BB_Width"] = out["BB_Upper"] - out["BB_Lower"]

    # Label: compare next day close to current close
    next_close = out["Close"].shift(-1)
    pct_change = (next_close - out["Close"]) / out["Close"]
    out["Label"] = pd.cut(
        pct_change,
        bins=[-np.inf, -0.02, 0.02, np.inf],
        labels=["Sell", "Hold", "Buy"],
    )

    column_order = [
        "Open", "High", "Low", "Close", "Volume",
        "SMA20", "EMA20", "RSI14", "MACD", "MACD_Signal",
        "BB_Upper", "BB_Lower", "BB_Width", "Label",
    ]
    out = out[column_order]
    out.dropna(inplace=True)
    return out


def get_feature_matrix(ticker: str) -> tuple[pd.DataFrame, pd.Series]:
    """
    Fetch OHLCV data and compute indicators for a single ticker.

    Returns (X, y) where:
      X — DataFrame of the 13 feature columns (Open through BB_Width)
      y — Series of Label values: "Buy", "Hold", or "Sell"
    """
    raw = fetch_stock_data(ticker)
    processed = calculate_indicators(raw)

    feature_cols = [
        "Open", "High", "Low", "Close", "Volume",
        "SMA20", "EMA20", "RSI14", "MACD", "MACD_Signal",
        "BB_Upper", "BB_Lower", "BB_Width",
    ]
    X = processed[feature_cols]
    y = processed["Label"].astype(str)
    return X, y


def get_multiple_tickers(tickers: list[str]) -> tuple[pd.DataFrame, pd.Series]:
    """
    Build a combined feature matrix across multiple tickers.

    Calls get_feature_matrix for each ticker, concatenates the results,
    and resets the index on both X and y so they share a clean integer index.

    Returns (X, y) with all tickers' data combined.
    """
    all_X = []
    all_y = []

    for ticker in tickers:
        X, y = get_feature_matrix(ticker)
        all_X.append(X)
        all_y.append(y)

    combined_X = pd.concat(all_X).reset_index(drop=True)
    combined_y = pd.concat(all_y).reset_index(drop=True)
    return combined_X, combined_y


if __name__ == "__main__":
    print("Fetching AAPL feature matrix...")
    X, y = get_feature_matrix("AAPL")
    print(f"X.shape: {X.shape}")
    print(f"y.value_counts():\n{y.value_counts()}")
