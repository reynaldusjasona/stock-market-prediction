from app.core.database import supabase


async def logActivity(
    userID: str,
    action: str,
    targetType: str = None,
    targetId: str = None,
    metadata: dict = None,
) -> None:
    try:
        supabase.table("activity_logs").insert({
            "user_id": userID,
            "action": action,
            "target_type": targetType,
            "target_id": targetId,
            "metadata": metadata or {},
        }).execute()
    except Exception as exc:
        print(f"[activity_service] Failed to log activity: {exc}")
