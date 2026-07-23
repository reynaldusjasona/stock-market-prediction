from zoneinfo import ZoneInfo
from pathlib import Path
from datetime import time

import pandas as pd

_MARKET_TZ = ZoneInfo("America/New_York")
_MARKET_OPEN = time(9, 30)
_MARKET_CLOSE = time(16, 0)

_HISTORICAL_SENTIMENT_FILE = (
    Path(__file__).resolve().parent.parent
    / "historical_sentiment_data"
    / "historical_daily_sentiment.csv"
)

def assign_to_trading_session(published_at: pd.Timestamp) -> pd.Timestamp:
    """
    Map an article's publish timestamp to the trading-session date where its
    information content is available for.

      - Timestamps are assumed to be in America/New_York
      - Published any time up to and including market close (16:00 ET)
        on a weekday -> that same calendar date. This includes
        pre-market news (for example: 6am headlines), since traders have already
        read it before that day's open and it's reflected in that day's
        price action, not a future one.
      - Published after 16:00 ET on a weekday, or at any time on a
        weekend -> the next trading day.

    Returns a normalized (midnight) pd.Timestamp date.
    """
    ts = pd.Timestamp(published_at)
    if ts.tzinfo is None:
        ts = ts.tz_localize(_MARKET_TZ)
    else:
        ts = ts.tz_convert(_MARKET_TZ)

    session_date = ts.normalize()

    is_weekday = ts.weekday() < 5
    same_day_eligible = is_weekday and ts.time() <= _MARKET_CLOSE

    if not same_day_eligible:
        # forward to the next weekday
        next_day = session_date + pd.Timedelta(days=1)
        while next_day.weekday() >= 5:
            next_day += pd.Timedelta(days=1)
        session_date = next_day

    return session_date.tz_localize(None)


def fetch_news(
    ticker: str, start: str, end: str, api_key: str, source: str = "finnhub"
) -> pd.DataFrame:
    """
    Fetch raw news articles for a ticker.

    Returns a DataFrame with columns: published_at, headline.

    Implements the Finnhub company-news endpoint.
    """
    if source != "finnhub":
        raise NotImplementedError(f"Unsupported source: {source}")

    resp = requests.get(
        "https://finnhub.io/api/v1/company-news",
        params={"symbol": ticker, "from": start, "to": end, "token": api_key},
        timeout=30,
    )
    resp.raise_for_status()
    articles = resp.json()

    rows = [
        {
            "published_at": pd.to_datetime(a["datetime"], unit="s", utc=True),
            "headline": a.get("headline", ""),
        }
        for a in articles
        if a.get("headline")
    ]

    if not rows:
        return pd.DataFrame(columns=["published_at", "headline"])

    return pd.DataFrame(rows)



def get_historical_daily_sentiment(
    ticker: str,
    start: str,
    end: str,
) -> pd.DataFrame:
    """
    Read historical GDELT daily sentiment features from CSV.

    Args:
        ticker:
            Stock ticker symbol.

        start:
            Start date in YYYY-MM-DD format.

        end:
            End date in YYYY-MM-DD format.

    Returns:
        DataFrame indexed by session date with:
        sentiment_mean, sentiment_std, and news_count.
    """
    if not _HISTORICAL_SENTIMENT_FILE.exists():
        raise FileNotFoundError(
            "Historical sentiment file not found: "
            f"{_HISTORICAL_SENTIMENT_FILE}"
        )

    df = pd.read_csv(
        _HISTORICAL_SENTIMENT_FILE,
        usecols=[
            "ticker",
            "session_date",
            "sentiment_mean",
            "sentiment_std",
            "news_count",
        ],
    )

    df["ticker"] = (
        df["ticker"]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    df["session_date"] = pd.to_datetime(
        df["session_date"],
        errors="coerce",
    )

    df["sentiment_mean"] = pd.to_numeric(
        df["sentiment_mean"],
        errors="coerce",
    )

    df["sentiment_std"] = pd.to_numeric(
        df["sentiment_std"],
        errors="coerce",
    )

    df["news_count"] = pd.to_numeric(
        df["news_count"],
        errors="coerce",
    )

    start_date = pd.to_datetime(start)
    end_date = pd.to_datetime(end)

    df = df[
        (df["ticker"] == ticker.upper())
        & (df["session_date"] >= start_date)
        & (df["session_date"] <= end_date)
    ].copy()

    if df.empty:
        empty = pd.DataFrame({
            "sentiment_mean": pd.Series(dtype="float64"),
            "sentiment_std": pd.Series(dtype="float64"),
            "news_count": pd.Series(dtype="int64"),
        })

        empty.index = pd.DatetimeIndex(
            [],
            name=None,
        )

        return empty

    df = df.dropna(
        subset=[
            "session_date",
            "sentiment_mean",
            "sentiment_std",
            "news_count",
        ]
    )

    df["news_count"] = df["news_count"].astype(int)

    df.set_index(
        "session_date",
        inplace=True,
    )

    df.index = df.index.normalize()
    df.index.name = None

    return df[
        [
            "sentiment_mean",
            "sentiment_std",
            "news_count",
        ]
    ]

def add_sentiment_features(
    out: pd.DataFrame,
    ticker: str,
    start: str,
    end: str,
) -> pd.DataFrame:
    """
    Join daily sentiment features onto the stock feature DataFrame.

    Args:
        out:
            Technical indicator DataFrame.

        ticker:
            Stock ticker symbol.

        start:
            Start date in YYYY-MM-DD format.

        end:
            End date in YYYY-MM-DD format.

    Returns:
        Input DataFrame with daily sentiment features added.
    """
    sentiment = get_historical_daily_sentiment(
        ticker=ticker,
        start=start,
        end=end,
    )

    out = out.join(sentiment, how="left")

    out["has_news"] = (
        out["sentiment_mean"]
        .notna()
        .astype(int)
    )

    out["sentiment_mean"] = (
        out["sentiment_mean"]
        .fillna(0.0)
    )

    out["sentiment_std"] = (
        out["sentiment_std"]
        .fillna(0.0)
    )

    out["news_count"] = (
        out["news_count"]
        .fillna(0)
        .astype(int)
    )

    out["sentiment_3d_avg"] = (
        out["sentiment_mean"]
        .rolling(3, min_periods=1)
        .mean()
    )

    out["sentiment_momentum"] = (
        out["sentiment_mean"]
        - out["sentiment_3d_avg"]
    )

    numeric_sentiment_cols = [
        "sentiment_mean",
        "sentiment_std",
        "news_count",
        "sentiment_3d_avg",
        "sentiment_momentum",
    ]

    for col in numeric_sentiment_cols:
        out[col] = pd.to_numeric(
            out[col],
            errors="coerce",
        )

    out["sentiment_mean"] = out["sentiment_mean"].fillna(0.0)
    out["sentiment_std"] = out["sentiment_std"].fillna(0.0)
    out["sentiment_3d_avg"] = out["sentiment_3d_avg"].fillna(0.0)
    out["sentiment_momentum"] = out["sentiment_momentum"].fillna(0.0)

    out["news_count"] = (
        out["news_count"]
        .fillna(0)
        .astype("int64")
    )

    out["has_news"] = (
        out["has_news"]
        .fillna(0)
        .astype("int64")
    )

    return out

if __name__ == "__main__":
    # test assign_to_trading_session() with edge case
    cases = [
        ("2024-03-11 08:00:00", "before-open weekday -> same day"),
        ("2024-03-11 10:00:00", "in-session weekday -> same day"),
        ("2024-03-11 17:30:00", "after-close weekday -> next day"),
        ("2024-03-08 18:00:00", "after-close Friday -> Monday"),
        ("2024-03-09 12:00:00", "Saturday -> Monday"),
    ]
    for ts_str, desc in cases:
        result = assign_to_trading_session(pd.Timestamp(ts_str))
        print(f"{desc:35s} {ts_str} is considered as {result.date()}")
    

