import asyncio
import logging
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Optional

import yfinance as yf

from app.core.api_clients import finnhubGet
from app.core.database import supabase
from app.services.recommendation_service import _parse_sector_preferences


_executor = ThreadPoolExecutor(max_workers=10)
logger = logging.getLogger(__name__)


# ---- yfinance helpers (sync, run in executor) ----
def _yf_quote_sync(ticker: str) -> dict:
    try:
        hist = yf.Ticker(ticker).history(period="5d")
        if hist.empty:
            return {"ticker": ticker, "error": "no data"}
        current_price = round(float(hist["Close"].iloc[-1]), 2)
        prev_close = round(float(hist["Close"].iloc[-2]), 2) if len(hist) > 1 else current_price
        change = round(current_price - prev_close, 4)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0
        return {
            "ticker": ticker,
            "current_price": current_price,
            "open": round(float(hist["Open"].iloc[-1]), 2),
            "high": round(float(hist["High"].iloc[-1]), 2),
            "low": round(float(hist["Low"].iloc[-1]), 2),
            "prev_close": prev_close,
            "volume": int(hist["Volume"].iloc[-1]),
            "timestamp": 0,
            "change": change,
            "change_percent": change_pct,
        }
    except Exception as exc:
        return {"ticker": ticker, "error": str(exc)}


def _yf_history_sync(ticker: str, period: str) -> list:
    _map = {"1W": "5d", "1M": "1mo", "3M": "3mo", "1Y": "1y"}

    def _f(v, default=0.0):
        try:
            f = float(v)
            return default if math.isnan(f) or math.isinf(f) else f
        except (TypeError, ValueError):
            return default

    try:
        hist = yf.Ticker(ticker).history(period=_map.get(period, "1mo"))
        if hist.empty:
            return []
        rows = []
        for idx, row in hist.iterrows():
            close = _f(row["Close"])
            if close == 0.0:
                continue
            rows.append({
                "date": str(idx.date()),
                "open": round(_f(row["Open"]), 4),
                "high": round(_f(row["High"]), 4),
                "low": round(_f(row["Low"]), 4),
                "close": round(close, 4),
                "volume": int(_f(row["Volume"])),
            })
        return rows
    except Exception:
        return []


async def _yf_quote(ticker: str) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _yf_quote_sync, ticker)


async def _yf_history(ticker: str, period: str) -> list:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _yf_history_sync, ticker, period)


# ---- interval-based history (candle size: 5M / 15M / 1H / 1D / 1W) ----
_INTERVAL_YF_MAP = {
    "5M":  {"yf_interval": "5m",  "yf_period": "30d"},
    "15M": {"yf_interval": "15m", "yf_period": "30d"},
    "1H":  {"yf_interval": "1h",  "yf_period": "90d"},
    "1D":  {"yf_interval": "1d",  "yf_period": "2y"},
    "1W":  {"yf_interval": "1wk", "yf_period": "5y"},
}


def _yf_interval_sync(ticker: str, interval: str) -> list:
    cfg = _INTERVAL_YF_MAP.get(interval.upper(), _INTERVAL_YF_MAP["1D"])
    is_intraday = interval.upper() in ("5M", "15M", "1H")

    def _f(v, default=0.0):
        try:
            f = float(v)
            return default if math.isnan(f) or math.isinf(f) else f
        except (TypeError, ValueError):
            return default

    try:
        hist = yf.Ticker(ticker).history(
            period=cfg["yf_period"], interval=cfg["yf_interval"]
        )
        if hist.empty:
            return []
        rows = []
        for idx, row in hist.iterrows():
            close = _f(row["Close"])
            if close == 0.0:
                continue
            time_val = int(idx.timestamp()) if is_intraday else str(idx.date())
            rows.append({
                "time": time_val,
                "open": round(_f(row["Open"]), 4),
                "high": round(_f(row["High"]), 4),
                "low": round(_f(row["Low"]), 4),
                "close": round(close, 4),
                "volume": int(_f(row["Volume"])),
            })
        return rows
    except Exception:
        return []


async def _yf_interval(ticker: str, interval: str) -> list:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _yf_interval_sync, ticker, interval)


async def getIntervalHistory(ticker: str, interval: str = "1D") -> list:
    return await _yf_interval(ticker.upper(), interval.upper())


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
async def _personalize_stock_order(
    stocks: list, userId: Optional[str]
) -> list:
    """
    Reorder stocks so ones in the investor's preferred sectors come
    first. No-op (returns stocks unchanged) when the caller is
    anonymous or hasn't set any sector preferences yet.
    """
    if not userId or not stocks:
        return stocks

    profile = (
        supabase.table("users")
        .select("sector_preferences")
        .eq("id", userId)
        .execute()
    )
    if not profile.data:
        return stocks

    sectorPreferences = _parse_sector_preferences(
        profile.data[0].get("sector_preferences")
    )
    if not sectorPreferences:
        return stocks

    tickers = [s["ticker"] for s in stocks]
    sectorResult = (
        supabase.table("stocks")
        .select("ticker, sector")
        .in_("ticker", tickers)
        .execute()
    )
    sectorByTicker = {
        r["ticker"]: r.get("sector") for r in (sectorResult.data or [])
    }

    preferred = [
        s for s in stocks
        if sectorByTicker.get(s["ticker"]) in sectorPreferences
    ]
    preferredTickers = {s["ticker"] for s in preferred}
    others = [s for s in stocks if s["ticker"] not in preferredTickers]
    return preferred + others


async def _enrich_with_prices(rows: list) -> list:
    """Fetch live price data for each stock and merge into the row."""
    async def _fetch_one(row):
        try:
            price_data = await fetchPriceData(row["ticker"])
            row["current_price"] = price_data.get("current_price")
            row["change_percent"] = price_data.get("change_percent")
        except Exception:
            row["current_price"] = None
            row["change_percent"] = None
        return row

    enriched = await asyncio.gather(*[_fetch_one(r) for r in rows])
    return list(enriched)


async def fetchStockList(userId: Optional[str] = None) -> list:
    raw = await finnhubGet("stock/symbol", {"exchange": "US"})
    if "error" in raw or not isinstance(raw, list):
        cached = (
            supabase.table("stocks")
            .select("ticker, company_name, exchange")
            .limit(100)
            .execute()
        )
        enriched = await _enrich_with_prices(cached.data or [])
        return await _personalize_stock_order(enriched, userId)
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
    for i in range(0, len(rows), 100):
        chunk = rows[i:i + 100]
        try:
            supabase.table("stocks").upsert(
                chunk, on_conflict="ticker"
            ).execute()
        except Exception:
            pass
    result = [
        {
            "ticker": r["ticker"],
            "company_name": r["company_name"],
            "exchange": r["exchange"],
        }
        for r in rows
    ]
    enriched = await _enrich_with_prices(result)
    return await _personalize_stock_order(enriched, userId)


async def fetchPriceData(ticker: str) -> dict:
    data = await finnhubGet("quote", {"symbol": ticker})
    if "error" in data:
        return await _yf_quote(ticker)
    current_price = round(data.get("c", 0), 2)
    prev_close = round(data.get("pc", 0), 2)
    change_pct = data.get("dp", 0)
    return {
        "ticker": ticker,
        "current_price": current_price,
        "open": round(data.get("o", 0), 2),
        "high": round(data.get("h", 0), 2),
        "low": round(data.get("l", 0), 2),
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
        .limit(100)
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
    sma20 = round(sum(closes[-20:]) / 20, 4) if len(closes) >= 20 else None
    ema20_series = _ema_list(closes, 20)
    ema20 = round(ema20_series[-1], 4) if ema20_series else None
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
    macd_result = {"macd_line": None, "signal_line": None, "histogram": None}
    if len(closes) >= 26:
        ema12 = _ema_list(closes, 12)
        ema26 = _ema_list(closes, 26)
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
    market_status = await finnhubGet("stock/market-status", {"exchange": "US"})
    is_open = (
        market_status.get("isOpen", False)
        if "error" not in market_status
        else False
    )
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
        output.append({
            "ticker": ticker,
            "company_name": name_map.get(ticker, ""),
            "current_price": res.get("current_price", 0),
            "change_percent": res.get("change_percent", 0),
            "market_open": is_open,
        })
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
    items = tickers[:10]
    quotes = await asyncio.gather(
        *[finnhubGet("quote", {"symbol": item["ticker"]}) for item in items],
        return_exceptions=True,
    )
    output = []
    for item, data in zip(items, quotes):
        if isinstance(data, Exception) or not data or "error" in data:
            continue
        output.append({
            "ticker": item["ticker"],
            "name": item.get("name", ""),
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


async def getPriceHistory(stock: str, period: str = "1M") -> list:
    period_days = {"1W": 7, "1M": 30, "3M": 90, "1Y": 365}
    days = period_days.get(period.upper(), 30)
    cutoff = (datetime.today() - timedelta(days=days)).strftime("%Y-%m-%d")
    result = (
        supabase.table("price_history")
        .select("date, open, high, low, close, volume")
        .eq("ticker", stock.upper())
        .gte("date", cutoff)
        .order("date", desc=False)
        .execute()
    )
    if result.data:
        return result.data
    return await _yf_history(stock.upper(), period)


async def getLivePrice(stock: str) -> dict:
    data = await finnhubGet("quote", {"symbol": stock.upper()})
    if not data or "error" in data:
        return {}

    def _round(v):
        return round(v, 2) if isinstance(v, (int, float)) else v

    return {
        "price": _round(data.get("c")),
        "change": data.get("d"),
        "change_percent": data.get("dp"),
        "high": _round(data.get("h")),
        "low": _round(data.get("l")),
        "open": _round(data.get("o")),
        "prev_close": _round(data.get("pc")),
    }


async def getLiveStockData(ticker: Optional[str] = None):
    if ticker:
        return await fetchPriceData(ticker)
    stock_data = await getStockData()
    return await getLiveUpdates(stock_data)


# ---- Fundamental Analysis (Finnhub) ----
# yf.Ticker().info was dropped here — Yahoo blocks Render's datacenter IPs,
# so it silently returned {} on every request. Finnhub's REST endpoints
# (already used everywhere else in this file) are reliable from Render.
async def _yf_fundamentals_sync(ticker: str) -> dict:
    profile, metric = await asyncio.gather(
        finnhubGet("stock/profile2", {"symbol": ticker}),
        finnhubGet("stock/metric", {"symbol": ticker, "metric": "all"}),
    )

    profile_ok = isinstance(profile, dict) and "error" not in profile
    if not profile_ok:
        logger.warning(
            "finnhub stock/profile2 fundamentals failed for %s: %s",
            ticker, profile,
        )
        profile = {}

    metric_ok = isinstance(metric, dict) and "error" not in metric
    if not metric_ok:
        logger.warning(
            "finnhub stock/metric fundamentals failed for %s: %s",
            ticker, metric,
        )
        metric_data = {}
    else:
        metric_data = metric.get("metric") or {}

    if not profile_ok and not metric_ok:
        return {}

    def _s(source, key, default=None):
        v = source.get(key)
        return v if v not in (None, "N/A", "None", "") else default

    market_cap_millions = _s(profile, "marketCapitalization")
    market_cap = (
        market_cap_millions * 1_000_000
        if isinstance(market_cap_millions, (int, float)) else None
    )

    share_outstanding_millions = _s(profile, "shareOutstanding")
    revenue_per_share = _s(metric_data, "revenuePerShareTTM")
    revenue = None
    if (
        isinstance(share_outstanding_millions, (int, float))
        and isinstance(revenue_per_share, (int, float))
    ):
        revenue = share_outstanding_millions * 1_000_000 * revenue_per_share

    industry = _s(profile, "finnhubIndustry")

    return {
        "market_cap": market_cap,
        "pe_ratio": _s(metric_data, "peBasicExclExtraTTM"),
        "forward_pe": _s(metric_data, "peNormalizedAnnual"),
        "eps": _s(
            metric_data, "epsInclExtraItemsTTM",
            _s(metric_data, "epsBasicExclExtraItemsTTM"),
        ),
        "revenue": revenue,
        "profit_margin": _s(metric_data, "netProfitMarginTTM"),
        "dividend_yield": _s(metric_data, "dividendYieldIndicatedAnnual"),
        "week52_high": _s(metric_data, "52WeekHigh"),
        "week52_low": _s(metric_data, "52WeekLow"),
        "beta": _s(metric_data, "beta"),
        "sector": industry,
        "industry": industry,
        "description": None,
        "employees": None,
        "roe": None,
        "debt_to_equity": None,
    }


async def fetchFundamentals(ticker: str) -> dict:
    return await _yf_fundamentals_sync(ticker)
