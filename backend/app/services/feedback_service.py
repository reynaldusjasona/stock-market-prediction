from datetime import datetime
from typing import Optional

from app.core.database import supabase


async def createFeedback(userID: str, subject: str, message: str) -> dict:
    result = (
        supabase.table("feedback")
        .insert({"user_id": userID, "subject": subject, "message": message})
        .execute()
    )
    return result.data[0]


async def getAllFeedback(
    status_filter: Optional[str], page: int, limit: int
) -> dict:
    offset = (page - 1) * limit

    query = supabase.table("feedback").select("*").order("created_at", desc=True)
    count_query = supabase.table("feedback").select("*", count="exact")

    if status_filter:
        query = query.eq("status", status_filter)
        count_query = count_query.eq("status", status_filter)

    result = query.range(offset, offset + limit - 1).execute()
    count_result = count_query.execute()

    return {
        "data": result.data or [],
        "total": count_result.count or 0,
        "page": page,
        "limit": limit,
    }


async def updateFeedbackStatus(feedbackID: str, new_status: str) -> Optional[dict]:
    result = (
        supabase.table("feedback")
        .update({
            "status": new_status,
            "responded_at": datetime.utcnow().isoformat(),
        })
        .eq("id", feedbackID)
        .execute()
    )
    return result.data[0] if result.data else None
