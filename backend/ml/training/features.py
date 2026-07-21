

import numpy as np
import pandas as pd
import yfinance as yf

from ml.score_historical_news import add_sentiment_features



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
    # used; flattenpython here
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    df = raw[["Open", "High", "Low", "Close", "Volume"]].copy()
    df = df.drop_duplicates()
    df = df.ffill()
    df.dropna(subset=["Open", "High", "Low", "Close", "Volume"], inplace=True)
    df.sort_index(inplace=True)
    return df


def calculate_indicators(df: pd.DataFrame, ticker: str, start: str = "2020-01-01", end: str = "2025-12-31", sentiment_source: str = "historical") -> pd.DataFrame:
    """
    Generate engineered features and prediction labels from raw OHLCV data.

    Feature calculated:
    - Technical indicators: SMA20, EMA20, RSI14, MACD, MACD Signal, Bollinger Bands (Upper, Lower, Width)
    - Price and momentum features: 1-day, 5-day, and 10-day returns, 10-day volatility, Distance from SMA20 and EMA20
    - Market-relative features: SPY 1-day, 5-day, and 10-day returns, SPY 10-day volatility, SPY distance from SMA20, Relative returns versus SPY
    - Market features:
        - Rolling volatility (5-day, 20-day)
        - Intraday trading range
        - Gap return
        - Relative trading volume
        - Candlestick body size
        - Upper and lower shadow

    - News sentiment features (Added add_sentiment_features()):
          - has_news
          - sentiment_mean
          - sentiment_std
          - news_count
          - sentiment_3d_avg
          - sentiment_momentum

    Prediction labels are generated using the next trading day's return.
    Future returns are divided into quantiles:
      Buy  - top 20% of future returns
      Sell - bottom 20% of future returns
      Hold - remaining 60%

    Returns:
        A DataFrame containing all features and the
        generated prediction label.
    """
    out = df.copy()

    #SPY returns for relative performance features
    spy = fetch_stock_data("SPY")
    spy["SPY_Return_1D"] = spy["Close"].pct_change(1)
    spy["SPY_Return_5D"] = spy["Close"].pct_change(5)

    # Longer market trend
    spy["SPY_Return_10D"] = spy["Close"].pct_change(10)

    # Market volatility
    spy["SPY_Volatility_10D"] = (
        spy["Close"]
        .pct_change()
        .rolling(window=10)
        .std()
    )

    # Distance from market trend
    spy["SPY_SMA20"] = (
        spy["Close"]
        .rolling(window=20)
        .mean()
    )

    spy["SPY_Distance_SMA20"] = (
        (spy["Close"] - spy["SPY_SMA20"])
        / spy["SPY_SMA20"]
    )

    spy = spy[[
        "SPY_Return_1D",
        "SPY_Return_5D",
        "SPY_Return_10D",
        "SPY_Volatility_10D",
        "SPY_Distance_SMA20",
    ]]

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

    # Return features
    out["Return_1D"] = out["Close"].pct_change(1)
    out["Return_5D"] = out["Close"].pct_change(5)
    out["Return_10D"] = out["Close"].pct_change(10)

    # Volatility feature
    out["Volatility_10D"] = out["Close"].pct_change().rolling(window=10).std()

    # Volume feature
    out["Volume_Ratio"] = out["Volume"] / out["Volume"].rolling(window=20).mean()

    # Price distance from moving averages
    out["Dist_SMA20"] = (out["Close"] - out["SMA20"]) / out["SMA20"]
    out["Dist_EMA20"] = (out["Close"] - out["EMA20"]) / out["EMA20"]

    # Label: compare next day close to current close and use quantile labeling 

    future_return = (
        out["Close"].shift(-1) - out["Close"]
    ) / out["Close"]

    lower = future_return.quantile(0.20) 
    upper = future_return.quantile(0.80)

    out["Label"] = "Hold"
    out.loc[future_return <= lower, "Label"] = "Sell"
    out.loc[future_return >= upper, "Label"] = "Buy"

    out = out.join(spy, how="left")

    out["Relative_Return_1D"] = (
    out["Return_1D"] - out["SPY_Return_1D"]
    )
    out["Relative_Return_5D"] = (
        out["Return_5D"] - out["SPY_Return_5D"]
    )

    out["Relative_Return_10D"] = (
        out["Return_10D"]
        - out["SPY_Return_10D"]
    )

    # Rolling volatility
    out["Volatility_5"] = (
        out["Return_1D"]
        .rolling(window=5)
        .std()
    )

    out["Volatility_20"] = (
        out["Return_1D"]
        .rolling(window=20)
        .std()
    )

    # Percentage range within the trading day
    out["Intraday_Range"] = (
        (out["High"] - out["Low"])
        / out["Close"]
    )

    # Difference between today's open and yesterday's close
    out["Gap_Return"] = (
        out["Open"]
        / out["Close"].shift(1)
        - 1
    )

    # Distance from moving averages
    out["Distance_SMA20"] = (
        out["Close"]
        / out["SMA20"]
        - 1
    )

    out["Distance_EMA20"] = (
        out["Close"]
        / out["EMA20"]
        - 1
    )

    # Relative trading volume
    out["Volume_MA20"] = (
        out["Volume"]
        .rolling(window=20)
        .mean()
    )

    out["Volume_Ratio_20"] = (
        out["Volume"]
        / out["Volume_MA20"]
    )

    # Candlestick body
    out["Body_Size"] = (
        (out["Close"] - out["Open"])
        / out["Open"]
    )

    # Upper wick
    out["Upper_Shadow"] = (
        out["High"]
        - out[["Open", "Close"]].max(axis=1)
    ) / out["Open"]

    # Lower wick
    out["Lower_Shadow"] = (
        out[["Open", "Close"]].min(axis=1)
        - out["Low"]
    ) / out["Open"]

    # Sentiment features
    out = add_sentiment_features(
        out=out,
        ticker=ticker,
        start=start,
        end=end,
        sentiment_source=sentiment_source,
    )

    out.dropna(inplace=True)

    column_order = [
        "Open", "High", "Low", "Close", "Volume",
        "SMA20", "EMA20", "RSI14", "MACD", "MACD_Signal",
        "BB_Upper", "BB_Lower", "BB_Width",
        "Return_1D", "Return_5D", "Return_10D",
        "Volatility_10D", "Volume_Ratio",
        "SPY_Return_1D", "SPY_Return_5D", "SPY_Return_10D", "SPY_Volatility_10D", "SPY_Distance_SMA20",
        "Relative_Return_1D", "Relative_Return_5D", "Relative_Return_10D",
        "Volatility_5", "Volatility_20",
        "Intraday_Range", "Gap_Return",
        "Distance_SMA20", "Distance_EMA20",
        "Body_Size", "Upper_Shadow", "Lower_Shadow",
        "has_news", "sentiment_mean", "sentiment_std", "news_count", "sentiment_3d_avg", "sentiment_momentum",
        "Label",
    ]

    out = out[column_order]
    out.dropna(inplace=True)

    return out

_FEATURE_COLS = [
    "Open", "High", "Low", "Close", "Volume",
    "SMA20", "EMA20", "RSI14", "MACD", "MACD_Signal",
    "BB_Upper", "BB_Lower", "BB_Width",
    "Return_1D", "Return_5D", "Return_10D",
    "Volatility_10D", "Volume_Ratio",
    "SPY_Return_1D", "SPY_Return_5D", "SPY_Return_10D", "SPY_Volatility_10D", "SPY_Distance_SMA20",
    "Relative_Return_1D", "Relative_Return_5D", "Relative_Return_10D",
    "Volatility_5", "Volatility_20",
    "Intraday_Range", "Gap_Return",
    "Distance_SMA20", "Distance_EMA20",
    "Body_Size", "Upper_Shadow", "Lower_Shadow",
    "has_news", "sentiment_mean", "sentiment_std", "news_count", "sentiment_3d_avg", "sentiment_momentum",
]


def get_feature_matrix(
    ticker: str,
    start: str = "2020-01-01",
    end: str = "2025-12-31",
    api_key: str | None = None,
    ) -> tuple[pd.DataFrame, pd.Series]:
    """
    Fetch OHLCV data and compute indicators for a single ticker.

    Returns (X, y) where:
      X — DataFrame of the feature columns defined in _FEATURE_COLS
      y — Series of Label values: "Buy", "Hold", or "Sell"
    """
    raw = fetch_stock_data(ticker=ticker, start=start, end=end)

    processed = calculate_indicators(raw, ticker=ticker, start=start, end=end)

    X = processed[_FEATURE_COLS]
    y = processed["Label"].astype(str)
    return X, y


def get_multiple_tickers(tickers: list[str], start: str = "2020-01-01", end: str = "2025-12-31",) -> tuple[pd.DataFrame, pd.Series]:

    all_data = []

    for ticker in tickers:
        print(f"Building features for {ticker}...")

        raw = fetch_stock_data(
            ticker=ticker,
            start=start,
            end=end,
        )

        processed = calculate_indicators(
            raw,
            ticker=ticker,
            start=start,
            end=end,
            
        )

        processed = processed.reset_index()

        if "Date" not in processed.columns:
            processed = processed.rename(
                columns={processed.columns[0]: "Date"}
            )

        processed["Ticker"] = ticker
        all_data.append(processed)

    if not all_data:
        raise ValueError("No ticker datasets were successfully created.")

    combined = pd.concat(all_data, ignore_index=True)
    combined = combined.sort_values(
        ["Date", "Ticker"]
    ).reset_index(drop=True)

    sentiment_cols = [
        "sentiment_mean",
        "sentiment_std",
        "news_count",
        "sentiment_3d_avg",
        "sentiment_momentum",
        "has_news",
    ]

    for col in sentiment_cols:
        combined[col] = pd.to_numeric(
            combined[col],
            errors="coerce",
        )

    combined["sentiment_mean"] = combined["sentiment_mean"].fillna(0.0)
    combined["sentiment_std"] = combined["sentiment_std"].fillna(0.0)
    combined["sentiment_3d_avg"] = combined["sentiment_3d_avg"].fillna(0.0)
    combined["sentiment_momentum"] = combined["sentiment_momentum"].fillna(0.0)

    combined["news_count"] = (
        combined["news_count"]
        .fillna(0)
        .astype("int64")
    )

    combined["has_news"] = (
        combined["has_news"]
        .fillna(0)
        .astype("int64")
    )

    X = combined[_FEATURE_COLS]
    y = combined["Label"].astype(str)

    return X, y

if __name__ == "__main__":
    print("Fetching AAPL feature matrix...")
    X, y = get_feature_matrix("AAPL")
    print(f"X.shape: {X.shape}")
    print(f"y.value_counts():\n{y.value_counts()}")
