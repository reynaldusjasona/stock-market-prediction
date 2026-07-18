from datetime import datetime

from fastapi import HTTPException

from app.core.database import supabase

_ADMIN_FIELDS = (
    "id, name, email, role, status, risk_tolerance, "
    "sector_preferences, created_at, updated_at, "
    "license_number, trader_status"
)


def _strip_hash(row: dict) -> dict:
    return {k: v for k, v in row.items() if k != "password_hash"}


async def validatePermission(adminID: str) -> bool:
    result = (
        supabase.table("users")
        .select("id, role, status")
        .eq("id", adminID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="Admin access required")
    admin = result.data[0]
    if admin["role"] != "admin" or admin["status"] != "active":
        raise HTTPException(status_code=403, detail="Admin access required")
    return True


async def verifyAdminSession(adminID: str) -> bool:
    result = (
        supabase.table("users")
        .select("id, role, status")
        .eq("id", adminID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="Admin access required")
    admin = result.data[0]
    if admin["role"] != "admin" or admin["status"] != "active":
        raise HTTPException(status_code=403, detail="Admin access required")
    return True


async def updateUserDetails(userID: str, role: str, status: str) -> dict:
    updates: dict = {}
    if role:
        updates["role"] = role
    if status:
        updates["status"] = status
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = (
        supabase.table("users")
        .update(updates)
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return _strip_hash(result.data[0])


async def findUserByID(userID: str, status: str) -> dict:
    result = (
        supabase.table("users")
        .select(_ADMIN_FIELDS)
        .eq("id", userID)
        .eq("status", status)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="User not found or not in the required status",
        )
    return result.data[0]


async def changeUserStatus(userID: str, status: str) -> dict:
    result = (
        supabase.table("users")
        .update({"status": status})
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return _strip_hash(result.data[0])


async def suspendAccount(adminID: str, userID: str) -> dict:
    await verifyAdminSession(adminID)
    await findUserByID(userID, "active")
    return await changeUserStatus(userID, "suspended")


async def searchUserByKeywords(keywords: str) -> list:
    pattern = f"%{keywords}%"
    result = (
        supabase.table("users")
        .select(_ADMIN_FIELDS)
        .or_(f"name.ilike.{pattern},email.ilike.{pattern}")
        .execute()
    )
    return result.data or []


async def getAllUserAccount() -> list:
    result = (
        supabase.table("users")
        .select(_ADMIN_FIELDS)
        .execute()
    )
    return result.data or []


async def getLatestMetrics() -> list:
    result = (
        supabase.table("prediction_metrics")
        .select("*")
        .order("evaluated_at", desc=True)
        .execute()
    )
    return result.data or []


async def getPriceAlerts() -> dict:
    result = (
        supabase.table("price_alerts")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    data = result.data or []

    return {
        "data": data,
        "total": len(data)
    }


async def getDashboardStats() -> dict:
    try:
        usersResult = (
            supabase.table("users").select("id", count="exact").execute()
        )
        subscriptionsResult = (
            supabase.table("subscriptions")
            .select("id", count="exact")
            .execute()
        )
        predictionsResult = (
            supabase.table("predictions")
            .select("id", count="exact")
            .execute()
        )
        alertsResult = (
            supabase.table("price_alerts")
            .select("id", count="exact")
            .execute()
        )
        return {
            "total_users": usersResult.count or 0,
            "total_subscriptions": subscriptionsResult.count or 0,
            "total_predictions": predictionsResult.count or 0,
            "total_alerts": alertsResult.count or 0,
        }
    except Exception:
        return {
            "total_users": 0,
            "total_subscriptions": 0,
            "total_predictions": 0,
            "total_alerts": 0,
        }


_FALLBACK_MODEL_METRICS = {
    "accuracy": 0.50,
    "buy_precision": 0.25,
    "sell_precision": 0.25,
    "hold_precision": 0.66,
    "roc_auc": 0.58,
    "training_samples": 50000,
    "last_trained": "2026-06-18",
    "note": "Fallback metrics from offline evaluation",
}


async def getModelPerformance() -> dict:
    try:
        result = (
            supabase.table("prediction_metrics")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
        return _FALLBACK_MODEL_METRICS
    except Exception:
        return _FALLBACK_MODEL_METRICS


_MODEL_CONFIG = {
    "model_type": "XGBoost (XGBClassifier)",
    "target_classes": ["Buy", "Hold", "Sell"],
    "features": [
        "SMA_5", "SMA_20", "SMA_50",
        "EMA_12", "EMA_26",
        "RSI_14",
        "MACD", "MACD_Signal", "MACD_Hist",
        "BB_Upper", "BB_Middle", "BB_Lower",
        "Stoch_K", "Stoch_D",
        "ATR_14",
        "OBV",
        "Daily_Return", "Volatility_20",
        "Price_vs_SMA20", "Price_vs_SMA50",
        "Volume_Ratio",
    ],
    "training_window": "5 years historical data per ticker",
    "class_balance_method": "sample_weight='balanced'",
    "threshold": (
        "±1% daily return (Buy > +1%, Sell < -1%, else Hold)"
    ),
    "data_sources": [
        "yfinance (training)",
        "Alpha Vantage (historical)",
        "Finnhub (real-time)",
    ],
    "deployment": "FastAPI on Render (512MB RAM, CPU-only inference)",
}


async def getModelConfig() -> dict:
    return _MODEL_CONFIG


async def getFeedbackById(feedbackId: str) -> dict:
    try:
        result = (
            supabase.table("feedback")
            .select("*")
            .eq("id", feedbackId)
            .execute()
        )
        if not result.data:
            return None
        row = result.data[0]
        userResult = (
            supabase.table("users")
            .select("id, name, email")
            .eq("id", row["user_id"])
            .execute()
        )
        user = userResult.data[0] if userResult.data else {}
        row["user_name"] = user.get("name", "Unknown")
        row["user_email"] = user.get("email", "Unknown")
        return row
    except Exception:
        return None


async def getAlertsSummary() -> dict:
    try:
        totalResult = (
            supabase.table("price_alerts")
            .select("id", count="exact")
            .execute()
        )
        activeResult = (
            supabase.table("price_alerts")
            .select("id", count="exact")
            .eq("is_active", True)
            .eq("is_triggered", False)
            .eq("is_dismissed", False)
            .execute()
        )
        triggeredResult = (
            supabase.table("price_alerts")
            .select("id", count="exact")
            .eq("is_triggered", True)
            .execute()
        )
        dismissedResult = (
            supabase.table("price_alerts")
            .select("id", count="exact")
            .eq("is_dismissed", True)
            .execute()
        )
        return {
            "total": totalResult.count or 0,
            "active": activeResult.count or 0,
            "triggered": triggeredResult.count or 0,
            "dismissed": dismissedResult.count or 0,
        }
    except Exception:
        return {"total": 0, "active": 0, "triggered": 0, "dismissed": 0}


async def dismissAlert(alertId: str) -> dict:
    try:
        existing = (
            supabase.table("price_alerts")
            .select("*")
            .eq("id", alertId)
            .execute()
        )
        if not existing.data:
            return None
        result = (
            supabase.table("price_alerts")
            .update({"is_dismissed": True, "is_active": False})
            .eq("id", alertId)
            .execute()
        )
        return result.data[0]
    except Exception:
        return None


async def getLandingContent() -> list:
    try:
        result = (
            supabase.table("landing_content")
            .select("*")
            .order("display_order")
            .execute()
        )
        return result.data
    except Exception:
        return []


async def updateLandingContent(sections: list, adminId: str) -> list:
    for section in sections:
        updateDict = {
            k: v for k, v in section.items() if k != "section_key"
        }
        updateDict["updated_at"] = datetime.utcnow().isoformat()
        updateDict["updated_by"] = adminId
        supabase.table("landing_content").update(updateDict).eq(
            "section_key", section["section_key"]
        ).execute()
    result = (
        supabase.table("landing_content")
        .select("*")
        .order("display_order")
        .execute()
    )
    return result.data


async def getActivityLogs(
    page: int = 1,
    limit: int = 20,
    actionFilter: str = None,
) -> dict:
    offset = (page - 1) * limit

    countQuery = supabase.table("activity_logs").select("id", count="exact")
    if actionFilter:
        countQuery = countQuery.eq("action", actionFilter)
    countResult = countQuery.execute()
    total = countResult.count or 0

    logsQuery = (
        supabase.table("activity_logs")
        .select("*")
        .order("created_at", desc=True)
    )
    if actionFilter:
        logsQuery = logsQuery.eq("action", actionFilter)
    logsResult = logsQuery.range(offset, offset + limit - 1).execute()
    logs = logsResult.data or []

    userIDs = list({log["user_id"] for log in logs if log.get("user_id")})
    userMap = {}
    if userIDs:
        usersResult = (
            supabase.table("users")
            .select("id, name, email")
            .in_("id", userIDs)
            .execute()
        )
        userMap = {u["id"]: u for u in (usersResult.data or [])}

    items = []
    for log in logs:
        user = userMap.get(log.get("user_id"), {})
        items.append({
            "id": log["id"],
            "user_id": log.get("user_id"),
            "user_name": user.get("name"),
            "user_email": user.get("email"),
            "action": log.get("action"),
            "target_type": log.get("target_type"),
            "target_id": log.get("target_id"),
            "metadata": log.get("metadata"),
            "created_at": log.get("created_at"),
        })

    return {"logs": items, "total": total, "page": page, "limit": limit}


_MODEL_QUALITY_FALLBACK = [
    {
        "class_name": "Buy",
        "precision_score": 0.25,
        "recall_score": 0.18,
        "f1_score": 0.21,
        "support": 1521,
    },
    {
        "class_name": "Hold",
        "precision_score": 0.66,
        "recall_score": 0.67,
        "f1_score": 0.67,
        "support": 4755,
    },
    {
        "class_name": "Sell",
        "precision_score": 0.25,
        "recall_score": 0.30,
        "f1_score": 0.27,
        "support": 1531,
    },
]


async def getModelQuality() -> dict:
    try:
        result = (
            supabase.table("model_class_metrics")
            .select("*")
            .order("class_name")
            .execute()
        )
        data = result.data or _MODEL_QUALITY_FALLBACK
    except Exception:
        data = _MODEL_QUALITY_FALLBACK
    return {
        "classes": [
            {
                "class_name": row["class_name"],
                "precision": row["precision_score"],
                "recall": row["recall_score"],
                "f1_score": row["f1_score"],
                "support": row["support"],
            }
            for row in data
        ],
        "last_updated": data[0].get("updated_at") if data else None,
    }


async def requestModelRetrain(user_id: str) -> dict:
    result = (
        supabase.table("model_retrain_requests")
        .insert({
            "requested_by": user_id,
            "status": "queued",
            "notes": "Retrain requested via admin dashboard",
        })
        .execute()
    )
    return {
        "message": "Model retrain request submitted",
        "status": "queued",
        "requested_at": result.data[0]["requested_at"],
    }


async def getRetrainStatus() -> dict:
    result = (
        supabase.table("model_retrain_requests")
        .select("*")
        .order("requested_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return {
            "last_trained": "2026-06-18",
            "status": "completed",
            "last_request": None,
        }
    latest = result.data[0]
    return {
        "last_trained": "2026-06-18",
        "status": latest["status"],
        "last_request": {
            "requested_at": latest["requested_at"],
            "status": latest["status"],
            "completed_at": latest.get("completed_at"),
            "notes": latest.get("notes"),
        },
    }


async def _getVerifiedTrader(userID: str) -> dict:
    result = (
        supabase.table("users")
        .select("id, role, trader_status, email, name")
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    user = result.data[0]
    if user["role"] != "trader":
        raise HTTPException(status_code=400, detail="User is not a trader")
    return user


async def approveTrader(userID: str) -> dict:
    user = await _getVerifiedTrader(userID)
    if user["trader_status"] == "approved":
        raise HTTPException(
            status_code=400, detail="Trader is already approved"
        )
    supabase.table("users").update({"trader_status": "approved"}).eq(
        "id", userID
    ).execute()
    return {
        "message": "Trader approved successfully",
        "user_id": userID,
        "trader_status": "approved",
    }


async def rejectTrader(userID: str) -> dict:
    user = await _getVerifiedTrader(userID)
    if user["trader_status"] == "rejected":
        raise HTTPException(
            status_code=400, detail="Trader is already rejected"
        )
    supabase.table("users").update({"trader_status": "rejected"}).eq(
        "id", userID
    ).execute()
    return {
        "message": "Trader rejected",
        "user_id": userID,
        "trader_status": "rejected",
    }
