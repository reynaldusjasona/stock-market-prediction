from fastapi import HTTPException

from app.core.database import supabase

_ADMIN_FIELDS = (
    "id, name, email, role, status, risk_tolerance, "
    "sector_preferences, created_at, updated_at"
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
