import asyncio
import math
from datetime import datetime, timedelta
from typing import Optional

from app.core.api_clients import alphaVantageGet, finnhubGet
from app.core.database import supabase

_TRENDING_FALLBACK = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "META", "NVDA", "JPM", "V", "JNJ",
]

_PERIOD_DAYS = {"1W": 7, "1M": 30, "3M": 90, "1Y": 365}


# ---- pure-Python indicator helpers (no pandas, no ta-lib) ----

def _ema_list(values: list, period: int) -> list:
    """Returns EMA series starting from index period-1 of the input."""
    if len(values) < period:
        return []
    k = 2.0 / (period + 1)
    series = [sum(values[:period]) / period]
    for v in values[period:]:
        series.append(v * k + series[-1] * (1.0 - k))
    return series


def _stddev(values: list) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    mean = sum(values) / n
    return math.sqrt(sum((v - mean) ** 2 for v in values) / n)


# ---- service functions ----

async def fetchStockList() -> list:
    raw = await finnhubGet("stock/symbol", {"exchange": "US"})
    if "error" in raw or not isinstance(raw, list):
        cached = (
            supabase.table("stocks")
            .select("ticker, company_name, exchange")
            .limit(100)
            .execute()
        )
        return cached.data or []

    # Limit to common-stock type to avoid thousands of exotic instruments
    stocks = [s for s in raw if s.get("type") == "CS"][:500]

    rows = [
        {
            "ticker": s["symbol"],
            "company_name": s.get("description", ""),
            "exchange": s.get("exchange", "US"),
        }
        for s in stocks
        if s.get("symbol")
    ]

    # Batch upsert in chunks of 100
    for i in range(0, len(rows), 100):
        chunk = rows[i:i + 100]
        try:
            supabase.table("stocks").upsert(
                chunk, on_conflict="ticker"
            ).execute()
        except Exception:
            pass

    return [
        {
            "ticker": r["ticker"],
            "company_name": r["company_name"],
            "exchange": r["exchange"],
        }
        for r in rows
    ]


async def fetchPriceData(ticker: str) -> dict:
    data = await finnhubGet("quote", {"symbol": ticker})
    if "error" in data:
        return {"ticker": ticker, "error": data["error"]}

    current_price = data.get("c", 0)
    prev_close = data.get("pc", 0)
    change_pct = data.get("dp", 0)  # Finnhub provides this directly

    return {
        "ticker": ticker,
        "current_price": current_price,
        "open": data.get("o", 0),
        "high": data.get("h", 0),
        "low": data.get("l", 0),
        "prev_close": prev_close,
        "volume": data.get("v", 0),
        "timestamp": data.get("t", 0),
        "change": round(data.get("d", 0), 4),
        "change_percent": round(change_pct, 2),
    }


async def queryStockDB(query: str) -> list:
    result = (
        supabase.table("stocks")
        .select("ticker, company_name, sector, exchange")
        .or_(f"ticker.ilike.%{query}%,company_name.ilike.%{query}%")
        .limit(20)
        .execute()
    )
    return result.data or []


async def calculateIndicators(priceData: list) -> dict:
    if not priceData:
        return {}

    closes = [
        float(d["close"]) for d in priceData
        if d.get("close") is not None
    ]
    if not closes:
        return {}

    # SMA 20
    sma20 = round(sum(closes[-20:]) / 20, 4) if len(closes) >= 20 else None

    # EMA 20
    ema20_series = _ema_list(closes, 20)
    ema20 = round(ema20_series[-1], 4) if ema20_series else None

    # RSI 14 (Wilder smoothing)
    rsi14 = None
    if len(closes) >= 15:
        deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
        gains = [d if d > 0 else 0.0 for d in deltas]
        losses = [-d if d < 0 else 0.0 for d in deltas]
        avg_gain = sum(gains[:14]) / 14.0
        avg_loss = sum(losses[:14]) / 14.0
        for i in range(14, len(gains)):
            avg_gain = (avg_gain * 13 + gains[i]) / 14.0
            avg_loss = (avg_loss * 13 + losses[i]) / 14.0
        if avg_loss == 0:
            rsi14 = 100.0
        else:
            rsi14 = round(100.0 - (100.0 / (1.0 + avg_gain / avg_loss)), 2)

    # MACD (12, 26, 9)
    macd_result = {"macd_line": None, "signal_line": None, "histogram": None}
    if len(closes) >= 26:
        ema12 = _ema_list(closes, 12)  # len = n - 11
        ema26 = _ema_list(closes, 26)  # len = n - 25
        if ema12 and ema26:
            overlap = len(ema26)
            ema12_aligned = ema12[len(ema12) - overlap:]
            macd_series = [ema12_aligned[i] - ema26[i] for i in range(overlap)]
            macd_line = macd_series[-1]
            signal_series = _ema_list(macd_series, 9)
            signal_line = signal_series[-1] if signal_series else None
            histogram = (
                (macd_line - signal_line)
                if signal_line is not None else None
            )
            macd_result = {
                "macd_line": round(macd_line, 4),
                "signal_line": (
                    round(signal_line, 4)
                    if signal_line is not None else None
                ),
                "histogram": (
                    round(histogram, 4)
                    if histogram is not None else None
                ),
            }

    # Bollinger Bands (20, 2)
    bollinger = {"upper": None, "middle": None, "lower": None}
    if len(closes) >= 20:
        window = closes[-20:]
        mid = sum(window) / 20.0
        std = _stddev(window)
        bollinger = {
            "upper": round(mid + 2 * std, 4),
            "middle": round(mid, 4),
            "lower": round(mid - 2 * std, 4),
        }

    return {
        "sma20": sma20,
        "ema20": ema20,
        "rsi14": rsi14,
        "macd": macd_result,
        "bollinger": bollinger,
    }


async def fetchTrendingTickers() -> list:
    # Check market status
    market_status = await finnhubGet("stock/market-status", {"exchange": "US"})
    is_open = (
        market_status.get("isOpen", False)
        if "error" not in market_status
        else False
    )

    # Prefer DB-cached tickers; fall back to hardcoded list
    db_result = (
        supabase.table("stocks")
        .select("ticker, company_name")
        .limit(10)
        .execute()
    )
    if db_result.data and len(db_result.data) >= 10:
        tickers = [s["ticker"] for s in db_result.data]
        name_map = {
            s["ticker"]: s.get("company_name", "")
            for s in db_result.data
        }
    else:
        tickers = _TRENDING_FALLBACK
        name_map = {t: t for t in tickers}

    price_results = await asyncio.gather(
        *[fetchPriceData(t) for t in tickers],
        return_exceptions=True,
    )

    output = []
    for i, res in enumerate(price_results):
        if (
            isinstance(res, Exception)
            or not isinstance(res, dict)
            or "error" in res
        ):
            continue
        ticker = tickers[i]
        output.append(
            {
                "ticker": ticker,
                "company_name": name_map.get(ticker, ""),
                "current_price": res.get("current_price", 0),
                "change_percent": res.get("change_percent", 0),
                "market_open": is_open,
            }
        )

    return output


async def getStockData(ticker: str) -> dict:
    cutoff = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    result = (
        supabase.table("price_history")
        .select("date, open, high, low, close, volume")
        .eq("ticker", ticker)
        .gte("date", cutoff)
        .order("date", desc=False)
        .execute()
    )
    if result.data:
        return {"ticker": ticker, "history": result.data}
    return await fetchPriceData(ticker)


async def getLiveUpdates() -> list:
    db_result = (
        supabase.table("stocks")
        .select("ticker, company_name")
        .limit(20)
        .execute()
    )
    if db_result.data:
        tickers = [s["ticker"] for s in db_result.data]
        name_map = {
            s["ticker"]: s.get("company_name", "")
            for s in db_result.data
        }
    else:
        tickers = _TRENDING_FALLBACK
        name_map = {t: t for t in tickers}

    price_results = await asyncio.gather(
        *[fetchPriceData(t) for t in tickers],
        return_exceptions=True,
    )

    output = []
    for i, res in enumerate(price_results):
        if (
            isinstance(res, Exception)
            or not isinstance(res, dict)
            or "error" in res
        ):
            continue
        ticker = tickers[i]
        output.append(
            {
                "ticker": ticker,
                "company_name": name_map.get(ticker, ""),
                "current_price": res.get("current_price", 0),
                "change_percent": res.get("change_percent", 0),
            }
        )

    return output


async def getPriceHistory(ticker: str, period: str = "1M") -> list:
    days = _PERIOD_DAYS.get(period, 30)
    outputsize = "full" if period == "1Y" else "compact"

    data = await alphaVantageGet(
        {
            "function": "TIME_SERIES_DAILY",
            "symbol": ticker,
            "outputsize": outputsize,
        }
    )

    if "error" in data or "Time Series (Daily)" not in data:
        # Return DB cache on API failure
        cutoff = (
            datetime.utcnow() - timedelta(days=days)
        ).strftime("%Y-%m-%d")
        cached = (
            supabase.table("price_history")
            .select("date, open, high, low, close, volume")
            .eq("ticker", ticker)
            .gte("date", cutoff)
            .order("date", desc=False)
            .execute()
        )
        return cached.data or []

    ts = data["Time Series (Daily)"]
    cutoff_dt = datetime.utcnow() - timedelta(days=days)

    rows = []
    upsert_rows = []
    for date_str in sorted(ts.keys()):
        if datetime.strptime(date_str, "%Y-%m-%d") < cutoff_dt:
            continue
        vals = ts[date_str]
        row = {
            "date": date_str,
            "open": float(vals["1. open"]),
            "high": float(vals["2. high"]),
            "low": float(vals["3. low"]),
            "close": float(vals["4. close"]),
            "volume": int(vals["5. volume"]),
        }
        rows.append(row)
        upsert_rows.append({"ticker": ticker, **row})

    # Cache to DB in batches
    for i in range(0, len(upsert_rows), 100):
        try:
            supabase.table("price_history").upsert(
                upsert_rows[i:i + 100], on_conflict="ticker,date"
            ).execute()
        except Exception:
            pass

    return rows


async def getLivePrice(ticker: str) -> dict:
    data = await finnhubGet("quote", {"symbol": ticker})
    if "error" in data:
        return {"ticker": ticker, "error": data["error"]}
    return {
        "ticker": ticker,
        "price": data.get("c", 0),
        "timestamp": data.get("t", 0),
    }


async def getOrderBook(ticker: str) -> dict:
    data = await finnhubGet("stock/bidask", {"symbol": ticker})
    if "error" in data:
        return {"ticker": ticker, "error": data["error"]}
    return {
        "ticker": ticker,
        "bid": data.get("b", 0),
        "ask": data.get("a", 0),
        "bid_volume": data.get("bv", 0),
        "ask_volume": data.get("av", 0),
        "timestamp": data.get("t", 0),
    }


async def getLiveStockData(ticker: Optional[str] = None):
    if ticker:
        return await fetchPriceData(ticker)
    return await getLiveUpdates()
