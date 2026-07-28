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


async def updateUserDetails(
    userID: str,
    role: str,
    status: str,
    name: str = "",
    email: str = "",
) -> dict:
    updates: dict = {}
    if role:
        updates["role"] = role
    if status:
        updates["status"] = status
    if name:
        updates["name"] = name
    if email:
        updates["email"] = email
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


async def unsuspendAccount(userID: str) -> dict:
    return await changeUserStatus(userID, "active")


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
    users = result.data or []
    if not users:
        return []

    userIDs = [u["id"] for u in users]
    subsResult = (
        supabase.table("subscriptions")
        .select("user_id, status, expires_at")
        .in_("user_id", userIDs)
        .execute()
    )
    subsMap = {s["user_id"]: s for s in (subsResult.data or [])}

    for user in users:
        sub = subsMap.get(user["id"])
        user["subscription_status"] = sub.get("status") if sub else None
        user["subscription_expires_at"] = (
            sub.get("expires_at") if sub else None
        )

    return users


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


async def _getModelAccuracy() -> float:
    try:
        result = (
            supabase.table("prediction_metrics")
            .select("accuracy")
            .order("evaluated_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return 0.0
        return result.data[0].get("accuracy", 0.0) or 0.0
    except Exception:
        return 0.0


async def _getPendingFeedbackCount() -> int:
    try:
        result = (
            supabase.table("feedback")
            .select("id", count="exact")
            .eq("status", "pending")
            .execute()
        )
        return result.count or 0
    except Exception:
        return 0


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
            "model_accuracy": await _getModelAccuracy(),
            "pending_feedback": await _getPendingFeedbackCount(),
        }
    except Exception:
        return {
            "total_users": 0,
            "total_subscriptions": 0,
            "total_predictions": 0,
            "total_alerts": 0,
            "model_accuracy": 0.0,
            "pending_feedback": 0,
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
    "recall": 0.0,
    "f1_score": 0.0,
    "model_version": "N/A",
}


async def getModelPerformance() -> dict:
    try:
        result = (
            supabase.table("prediction_metrics")
            .select("*")
            .order("evaluated_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            row["recall"] = row.get("recall_score") or 0.0
            row["f1_score"] = row.get("f1_score") or 0.0
            row["last_trained"] = row.get("evaluated_at") or "N/A"
            row["model_version"] = row.get("model_version") or "N/A"
            return row
        return _FALLBACK_MODEL_METRICS
    except Exception:
        return _FALLBACK_MODEL_METRICS


_MODEL_CONFIG = {
    "model_type": "XGBoost (XGBClassifier)",
    "target_classes": ["Buy", "Hold", "Sell"],
    "features": [
        "Open", "High", "Low", "Close", "Volume",
        "SMA20", "EMA20", "RSI14", "MACD", "MACD_Signal",
        "BB_Upper", "BB_Lower", "BB_Width",
        "Return_1D", "Return_5D", "Return_10D",
        "Volatility_10D", "Volume_Ratio",
        "SPY_Return_1D", "SPY_Return_5D", "SPY_Return_10D",
        "SPY_Volatility_10D", "SPY_Distance_SMA20",
        "Relative_Return_1D", "Relative_Return_5D", "Relative_Return_10D",
        "Volatility_5", "Volatility_20",
        "Intraday_Range", "Gap_Return",
        "Distance_SMA20", "Distance_EMA20",
        "Body_Size", "Upper_Shadow", "Lower_Shadow",
        "has_news", "sentiment_mean", "sentiment_std", "news_count",
        "sentiment_3d_avg", "sentiment_momentum",
    ],
    "training_window": "5 years historical data per ticker",
    "class_balance_method": "sample_weight='balanced'",
    "threshold": (
        "Per-ticker quantile labeling: top 20% of next-day returns -> Buy, "
        "bottom 20% -> Sell, middle 60% -> Hold"
    ),
    "training_tickers": "35 tickers across 7 sectors",
    "accuracy": "~50% (balanced)",
    "roc_auc": "~0.65",
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


async def getLandingContent() -> dict:
    try:
        result = (
            supabase.table("landing_page_config")
            .select("*")
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0].get("content", {})
        return {}
    except Exception:
        return {}


async def updateLandingContent(content: dict, adminID: str) -> dict:
    try:
        existing = (
            supabase.table("landing_page_config")
            .select("id")
            .limit(1)
            .execute()
        )
        if existing.data:
            rowID = existing.data[0]["id"]
            result = (
                supabase.table("landing_page_config")
                .update({
                    "content": content,
                    "updated_at": "now()",
                    "updated_by": adminID,
                })
                .eq("id", rowID)
                .execute()
            )
        else:
            result = (
                supabase.table("landing_page_config")
                .insert({
                    "content": content,
                    "updated_by": adminID,
                })
                .execute()
            )
        if result.data:
            return result.data[0].get("content", {})
        return content
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        user = userMap.get(log.get("user_id"))
        items.append({
            "id": log["id"],
            "user_id": log.get("user_id"),
            "user_name": user.get("name") if user else None,
            "user_email": user.get("email") if user else None,
            "admin_name": user.get("name") if user else "Unknown",
            "admin_email": user.get("email") if user else "Unknown",
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


_LICENSE_AUTHORITIES = {
    "CFA-": "CFA Institute",
    "MAS-": "MAS Singapore",
    "FINRA-": "FINRA USA",
}


async def verifyLicense(number: str) -> dict:
    """
    Mock license verification (CFA / MAS / FINRA prefixes only).

    Not connected to any real registry -- for the trader-approval
    simulation only. Every response is flagged "mocked": True.
    """
    number_upper = number.strip().upper()

    for prefix, authority in _LICENSE_AUTHORITIES.items():
        if number_upper.startswith(prefix):
            holder = number_upper.replace(prefix, "").replace("-", " ").title()
            return {
                "valid": True,
                "authority": authority,
                "status": "Active",
                "holder": holder,
                "license_number": number,
                "mocked": True,
            }

    return {
        "valid": False,
        "reason": "License format not recognised",
        "license_number": number,
        "mocked": True,
    }


_API_SOURCE_FIELDS = {
    "name",
    "base_url",
    "api_key_masked",
    "rate_limit",
    "api_type",
    "description",
    "is_enable",
    "status",
}


async def getApiSources() -> dict:
    result = (
        supabase.table("api_sources")
        .select("*")
        .order("name")
        .execute()
    )
    data = result.data or []
    return {"sources": data, "count": len(data)}


async def getApiSourceById(sourceId: str) -> dict:
    result = (
        supabase.table("api_sources")
        .select("*")
        .eq("id", sourceId)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="API source not found")
    return result.data[0]


async def createApiSource(data: dict) -> dict:
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Name is required")
    insert_data = {k: v for k, v in data.items() if k in _API_SOURCE_FIELDS}
    if "is_enable" in insert_data:
        insert_data["is_enabled"] = insert_data.pop("is_enable")
    result = supabase.table("api_sources").insert(insert_data).execute()
    return result.data[0]


async def updateApiSource(sourceId: str, data: dict) -> dict:
    await getApiSourceById(sourceId)
    update_data = {k: v for k, v in data.items() if k in _API_SOURCE_FIELDS}
    if not update_data:
        raise HTTPException(
            status_code=400, detail="No valid fields to update"
        )
    if "is_enable" in update_data:
        update_data["is_enabled"] = update_data.pop("is_enable")
    update_data["updated_at"] = datetime.utcnow().isoformat()
    result = (
        supabase.table("api_sources")
        .update(update_data)
        .eq("id", sourceId)
        .execute()
    )
    return result.data[0]


async def deleteApiSource(sourceId: str) -> dict:
    await getApiSourceById(sourceId)
    supabase.table("api_sources").delete().eq("id", sourceId).execute()
    return {"message": "API source deleted", "id": sourceId}


async def getAdminAlerts() -> list:
    try:
        result = (
            supabase.table("admin_alerts")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []
    except Exception:
        return []


async def getAdminAlertsSummary() -> dict:
    try:
        result = (
            supabase.table("admin_alerts")
            .select("severity, is_resolved")
            .execute()
        )
        rows = result.data or []
        summary = {
            "critical": 0,
            "warning": 0,
            "info": 0,
            "total": 0,
            "resolved": 0,
            "unresolved": 0,
        }
        for row in rows:
            severity = row.get("severity")
            if severity in summary:
                summary[severity] += 1
            summary["total"] += 1
            if row.get("is_resolved"):
                summary["resolved"] += 1
            else:
                summary["unresolved"] += 1
        return summary
    except Exception:
        return {
            "critical": 0,
            "warning": 0,
            "info": 0,
            "total": 0,
            "resolved": 0,
            "unresolved": 0,
        }


async def resolveAdminAlert(alertID: str) -> dict:
    try:
        result = (
            supabase.table("admin_alerts")
            .update({"is_resolved": True})
            .eq("id", alertID)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Alert not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Alert not found")
