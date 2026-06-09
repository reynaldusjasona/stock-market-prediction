from datetime import datetime, timedelta, timezone

from app.core.database import supabase


async def getNotifications(userID: str, db, timeframe: str = None) -> list:
    query = supabase.table("notifications").select("*").eq("user_id", userID)

    if timeframe is not None:
        now = datetime.now(timezone.utc)
        if timeframe == "today":
            cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif timeframe == "week":
            cutoff = now - timedelta(days=7)
        elif timeframe == "month":
            cutoff = now - timedelta(days=30)
        else:
            cutoff = None

        if cutoff is not None:
            query = query.gte("created_at", cutoff.isoformat())

    result = query.order("created_at", desc=True).execute()
    return result.data or []


async def markAsRead(notificationID: str, userID: str, db) -> bool:
    result = (
        supabase.table("notifications")
        .update({"is_read": True})
        .eq("id", notificationID)
        .eq("user_id", userID)
        .execute()
    )
    return bool(result.data)


async def sendPendingEmailNotification(userID: str, db, email_func) -> None:
    unread = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", userID)
        .eq("is_read", False)
        .execute()
    )
    notifications = unread.data or []
    if not notifications:
        return

    user_result = supabase.table("users").select("email").eq("id", userID).execute()
    if not user_result.data:
        return
    user_email = user_result.data[0]["email"]

    for notification in notifications:
        message = f"{notification['title']}: {notification['message']}"
        await email_func(user_email, message)
