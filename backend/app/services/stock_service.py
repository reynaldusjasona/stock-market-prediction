import asyncio
import math
from typing import Optional

from fastapi import HTTPException

from app.core.api_clients import finnhubGet
from app.core.database import supabase

_TRENDING_FALLBACK = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "META", "NVDA", "JPM", "V", "JNJ",
]


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


async def getStockData() -> list:
    result = (
        supabase.table("stocks")
        .select("ticker, company_name")
        .limit(20)
        .execute()
    )
    if result.data:
        return [
            {"ticker": r["ticker"], "name": r.get("company_name", "")}
            for r in result.data
        ]
    return [{"ticker": t, "name": t} for t in _TRENDING_FALLBACK]


async def getLiveUpdates(tickers: list) -> list:
    output = []
    for item in tickers[:10]:
        ticker = item["ticker"]
        name = item.get("name", "")
        data = await finnhubGet("quote", {"symbol": ticker})
        if not data or "error" in data:
            continue
        output.append({
            "ticker": ticker,
            "name": name,
            "price": data.get("c"),
            "change": data.get("d"),
            "change_percent": data.get("dp"),
        })
    return output


async def getTopGainersandLosers() -> dict:
    stock_data = await getStockData()
    updates = await getLiveUpdates(stock_data)
    gainers = sorted(
        updates, key=lambda x: x.get("change_percent") or 0, reverse=True
    )[:5]
    losers = sorted(
        updates, key=lambda x: x.get("change_percent") or 0
    )[:5]
    return {"gainers": gainers, "losers": losers}


async def getPriceHistory(stock: str) -> list:
    result = (
        supabase.table("price_history")
        .select("date, open, high, low, close, volume")
        .eq("ticker", stock.upper())
        .order("date", desc=False)
        .execute()
    )
    return result.data or []


async def getLivePrice(stock: str) -> dict:
    data = await finnhubGet("quote", {"symbol": stock.upper()})
    if not data or "error" in data:
        return {}
    return {
        "price": data.get("c"),
        "change": data.get("d"),
        "change_percent": data.get("dp"),
        "high": data.get("h"),
        "low": data.get("l"),
        "open": data.get("o"),
        "prev_close": data.get("pc"),
    }


async def getOrderBook(stock: str) -> dict:
    data = await finnhubGet("stock/bidask", {"symbol": stock.upper()})
    if not data or "error" in data:
        raise HTTPException(
            status_code=404,
            detail=f"Order book unavailable for {stock}",
        )
    return {
        "ticker": stock.upper(),
        "ask": data.get("a"),
        "bid": data.get("b"),
        "ask_volume": data.get("av"),
        "bid_volume": data.get("bv"),
        "timestamp": data.get("t"),
    }


async def getLiveStockData(ticker: Optional[str] = None):
    if ticker:
        return await fetchPriceData(ticker)
    stock_data = await getStockData()
    return await getLiveUpdates(stock_data)
