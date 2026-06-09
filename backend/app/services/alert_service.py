from app.core.api_clients import finnhubGet
from app.core.database import supabase
from app.core.email import sendPendingEmailNotification as send_email


async def validateAndSaveAlert(ticker: str, targetPrice: float, condition: str, userID: str) -> dict:
    if condition not in ("above", "below"):
        raise ValueError("condition must be 'above' or 'below'")
    if targetPrice <= 0:
        raise ValueError("targetPrice must be greater than 0")

    result = (
        supabase.table("price_alerts")
        .insert({
            "user_id": userID,
            "ticker": ticker,
            "target_price": targetPrice,
            "condition": condition,
            "is_active": True,
            "is_triggered": False,
        })
        .execute()
    )
    return result.data[0]


async def markAlertAsTriggered(alertID: str) -> None:
    supabase.table("price_alerts").update(
        {"is_triggered": True, "is_active": False}
    ).eq("id", alertID).execute()


async def detectAlertCondition(userID: str, ticker: str) -> list:
    result = (
        supabase.table("price_alerts")
        .select("*")
        .eq("user_id", userID)
        .eq("ticker", ticker)
        .eq("is_active", True)
        .eq("is_triggered", False)
        .execute()
    )
    alerts = result.data or []
    if not alerts:
        return []

    quote = await finnhubGet("quote", {"symbol": ticker})
    current_price = quote.get("c", 0.0)

    user_result = supabase.table("users").select("email").eq("id", userID).execute()
    user_email = user_result.data[0]["email"] if user_result.data else None

    triggered = []
    for alert in alerts:
        condition = alert["condition"]
        target_price = alert["target_price"]

        is_triggered = (
            (condition == "above" and current_price >= target_price)
            or (condition == "below" and current_price <= target_price)
        )
        if not is_triggered:
            continue

        await markAlertAsTriggered(alert["id"])

        message = (
            f"{ticker} has reached {current_price}. "
            f"Your {condition} alert at {target_price} was triggered."
        )
        supabase.table("notifications").insert({
            "user_id": userID,
            "title": "Price Alert Triggered",
            "message": message,
            "is_read": False,
        }).execute()

        if user_email:
            await send_email(user_email, message)

        triggered.append(alert)

    return triggered


async def validateInput(alertID: str, newPrice: float, alertType: str) -> bool:
    if alertType not in ("above", "below"):
        raise ValueError("alertType must be 'above' or 'below'")
    if newPrice <= 0:
        raise ValueError("newPrice must be greater than 0")
    return True


async def updatePriceAlerts(alertID: str, newPrice: float, alertType: str, userID: str) -> dict:
    await validateInput(alertID, newPrice, alertType)

    result = (
        supabase.table("price_alerts")
        .update({"target_price": newPrice, "condition": alertType})
        .eq("id", alertID)
        .eq("user_id", userID)
        .execute()
    )
    if not result.data:
        raise LookupError("Alert not found")
    return result.data[0]


async def deletePriceAlert(alertID: str, userID: str) -> bool:
    result = (
        supabase.table("price_alerts")
        .delete()
        .eq("id", alertID)
        .eq("user_id", userID)
        .execute()
    )
    return bool(result.data)


async def getAlertForm(ticker: str, userID: str) -> list:
    result = (
        supabase.table("price_alerts")
        .select("*")
        .eq("user_id", userID)
        .eq("ticker", ticker)
        .execute()
    )
    return result.data or []
