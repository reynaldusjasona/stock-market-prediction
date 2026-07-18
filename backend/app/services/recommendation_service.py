import json

from app.core.database import supabase

# users.risk_tolerance is stored lowercase ("low"/"moderate"/"high"),
# while predictions.risk_level is stored as "Low Risk"/"Moderate Risk"/
# "High Risk" — both sides are normalized to this scale before comparing.
_RISK_ORDER = {"low": 1, "moderate": 2, "high": 3}


def _dedupe_by_ticker(predictions: list) -> list:
    seen = set()
    deduped = []
    for pred in predictions:
        ticker = pred.get("ticker")
        if ticker in seen:
            continue
        seen.add(ticker)
        deduped.append(pred)
    return deduped


async def _lookup_stocks(tickers: list) -> dict:
    if not tickers:
        return {}
    result = (
        supabase.table("stocks")
        .select("ticker, company_name, sector")
        .in_("ticker", tickers)
        .execute()
    )
    return {s["ticker"]: s for s in (result.data or [])}


def _build_recommendation(pred: dict, stockMap: dict) -> dict:
    ticker = pred.get("ticker")
    stock = stockMap.get(ticker, {})
    signal = pred.get("signal")
    confidence = pred.get("confidence_score") or 0
    if signal == "Buy":
        reason = f"Strong buy signal with {confidence:.0f}% confidence"
    elif signal == "Sell":
        reason = f"Sell signal detected with {confidence:.0f}% confidence"
    else:
        reason = f"{signal} signal with {confidence:.0f}% confidence"
    return {
        "ticker": ticker,
        "company_name": stock.get("company_name"),
        "sector": stock.get("sector"),
        "signal": signal,
        "confidence_score": confidence,
        "risk_level": pred.get("risk_level"),
        "reason": reason,
    }


async def getGeneralRecommendations(limit: int = 10) -> list:
    try:
        result = (
            supabase.table("predictions")
            .select("*")
            .in_("signal", ["Buy", "Sell"])
            .order("confidence_score", desc=True)
            .limit(limit)
            .execute()
        )
        predictions = _dedupe_by_ticker(result.data or [])

        if not predictions:
            stocksResult = (
                supabase.table("stocks").select("*").limit(limit).execute()
            )
            return [
                {
                    "ticker": s["ticker"],
                    "company_name": s.get("company_name"),
                    "sector": s.get("sector"),
                    "signal": "Hold",
                    "confidence_score": 50,
                    "risk_level": "Moderate Risk",
                    "reason": (
                        "No prediction data available yet — run a "
                        "prediction to get signals"
                    ),
                }
                for s in (stocksResult.data or [])
            ]

        tickers = [p["ticker"] for p in predictions]
        stockMap = await _lookup_stocks(tickers)
        return [_build_recommendation(p, stockMap) for p in predictions]
    except Exception:
        return []


def _parse_sector_preferences(raw) -> set:
    if not raw:
        return None
    if isinstance(raw, list):
        return {str(s).strip() for s in raw if s}
    if isinstance(raw, str):
        stripped = raw.strip()
        if not stripped:
            return None
        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
                return {str(s).strip() for s in parsed if s}
            except (ValueError, TypeError):
                pass
        return {
            part.strip() for part in stripped.split(",") if part.strip()
        }
    return None


def _normalize_risk_level(riskLevel) -> str:
    if not riskLevel:
        return None
    normalized = str(riskLevel).lower().replace(" risk", "").strip()
    return normalized if normalized in _RISK_ORDER else None


def _allowed_risk_levels(riskTolerance) -> set:
    normalizedTolerance = (
        str(riskTolerance).lower().strip() if riskTolerance else None
    )
    if normalizedTolerance not in _RISK_ORDER:
        return None
    order = _RISK_ORDER[normalizedTolerance]
    return {level for level, val in _RISK_ORDER.items() if val <= order}


async def getPersonalizedRecommendations(userId: str, limit: int = 10) -> list:
    try:
        userResult = (
            supabase.table("users")
            .select("risk_tolerance, sector_preferences")
            .eq("id", userId)
            .execute()
        )
        if not userResult.data:
            return await getGeneralRecommendations(limit)
        profile = userResult.data[0]
        riskTolerance = profile.get("risk_tolerance")
        sectorPreferences = _parse_sector_preferences(
            profile.get("sector_preferences")
        )

        portfolioResult = (
            supabase.table("portfolio")
            .select("ticker")
            .eq("user_id", userId)
            .execute()
        )
        heldTickers = {row["ticker"] for row in (portfolioResult.data or [])}

        watchlistResult = (
            supabase.table("watchlist")
            .select("ticker")
            .eq("user_id", userId)
            .execute()
        )
        watchedTickers = {
            row["ticker"] for row in (watchlistResult.data or [])
        }

        predictionsResult = (
            supabase.table("predictions")
            .select("*")
            .in_("signal", ["Buy", "Sell"])
            .order("confidence_score", desc=True)
            .limit(50)
            .execute()
        )
        predictions = _dedupe_by_ticker(predictionsResult.data or [])
        predictions = [
            p for p in predictions if p.get("ticker") not in heldTickers
        ]

        allowedRisk = _allowed_risk_levels(riskTolerance)
        if allowedRisk is not None:
            predictions = [
                p for p in predictions
                if _normalize_risk_level(p.get("risk_level")) in allowedRisk
            ]

        tickers = [p["ticker"] for p in predictions]
        stockMap = await _lookup_stocks(tickers)

        if sectorPreferences:
            preferred = [
                p for p in predictions
                if stockMap.get(p["ticker"], {}).get("sector")
                in sectorPreferences
            ]
            others = [p for p in predictions if p not in preferred]
            predictions = preferred + others

        recommendations = []
        for pred in predictions[:limit]:
            rec = _build_recommendation(pred, stockMap)
            if pred.get("ticker") in watchedTickers:
                rec["reason"] += " (on your watchlist)"
            recommendations.append(rec)

        if not recommendations:
            return await getGeneralRecommendations(limit)
        return recommendations
    except Exception:
        return await getGeneralRecommendations(limit)
