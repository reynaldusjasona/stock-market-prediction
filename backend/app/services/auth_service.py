import re

from fastapi import HTTPException

from app.core.database import supabase
from app.core.security import createAccessToken, hashPassword, verifyPassword

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
_VALID_LEVELS = {"low", "moderate", "high"}

_PUBLIC_FIELDS = (
    "id, name, email, role, status, risk_tolerance, "
    "sector_preferences, created_at, updated_at"
)


def _strip_hash(row: dict) -> dict:
    return {k: v for k, v in row.items() if k != "password_hash"}


async def validateInputs(name: str, email: str, password: str) -> dict:
    if not name or not name.strip():
        return {"valid": False, "error": "Name is required"}
    if not _EMAIL_RE.match(email):
        return {"valid": False, "error": "Invalid email format"}
    if len(password) < 8:
        return {"valid": False, "error": "Password must be at least 8 characters"}
    return {"valid": True}


async def savePreferences(userID: str, sectors: list, level: str) -> dict:
    result = (
        supabase.table("users")
        .update({"sector_preferences": sectors, "risk_tolerance": level})
        .eq("id", userID)
        .execute()
    )
    return result.data[0] if result.data else {}


async def login(identifier: str, password: str) -> dict:
    result = (
        supabase.table("users")
        .select("*")
        .eq("email", identifier)
        .eq("status", "active")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = result.data[0]
    if not verifyPassword(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = createAccessToken(
        {"sub": user["id"], "email": user["email"], "role": user["role"]}
    )
    supabase.table("users").update({"session_token": token}).eq("id", user["id"]).execute()
    return {"token": token, "user": _strip_hash(user)}


async def getUserDetails(investorID: str) -> dict:
    result = (
        supabase.table("users")
        .select(_PUBLIC_FIELDS)
        .eq("id", investorID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


async def getInvestorRecordForEdit(investorID: str) -> dict:
    result = (
        supabase.table("users")
        .select(_PUBLIC_FIELDS)
        .eq("id", investorID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


async def updateAccount(investorID: str, name: str, password: str) -> dict:
    updates: dict = {}
    if name:
        updates["name"] = name
    if password:
        updates["password_hash"] = hashPassword(password)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = (
        supabase.table("users")
        .update(updates)
        .eq("id", investorID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return _strip_hash(result.data[0])


async def validateFormInput(data: dict) -> dict:
    name = data.get("name")
    password = data.get("password")
    if name is not None and not str(name).strip():
        return {"valid": False, "error": "Name cannot be empty"}
    if password is not None and len(str(password)) < 8:
        return {"valid": False, "error": "Password must be at least 8 characters"}
    return {"valid": True}


async def getDeleteConfirm(userID: str) -> dict:
    result = (
        supabase.table("users")
        .select("id, name, email, role, status, session_token")
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


async def deleteAccount(userID: str) -> bool:
    return await deleteAccountAndData(userID)


async def deleteAccountAndData(userID: str) -> bool:
    result = (
        supabase.table("users")
        .update({"status": "deleted", "session_token": None})
        .eq("id", userID)
        .execute()
    )
    return bool(result.data)


async def invalidateSession(sessionToken: str) -> bool:
    supabase.table("users").update({"session_token": None}).eq(
        "session_token", sessionToken
    ).execute()
    return True


async def getRiskTolerance(userID: str) -> dict:
    result = (
        supabase.table("users")
        .select("risk_tolerance")
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"risk_tolerance": result.data[0]["risk_tolerance"]}


async def updateRiskTolerance(userID: str, level: str) -> dict:
    if level not in _VALID_LEVELS:
        raise HTTPException(
            status_code=400, detail="Level must be one of: low, moderate, high"
        )
    result = (
        supabase.table("users")
        .update({"risk_tolerance": level})
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return _strip_hash(result.data[0])


async def validateAndSave(data: dict, userID: str) -> dict:
    updates: dict = {}
    if "level" in data:
        level = data["level"]
        if level not in _VALID_LEVELS:
            raise HTTPException(
                status_code=400, detail="Level must be one of: low, moderate, high"
            )
        updates["risk_tolerance"] = level
    if "preferences" in data:
        prefs = data["preferences"]
        if not isinstance(prefs, list):
            raise HTTPException(status_code=400, detail="Preferences must be a list")
        updates["sector_preferences"] = prefs
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = (
        supabase.table("users")
        .update(updates)
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return _strip_hash(result.data[0])


async def updateRecommendations(userID: str) -> bool:
    return True


async def getPreferences(userID: str) -> dict:
    result = (
        supabase.table("users")
        .select("sector_preferences, risk_tolerance")
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


async def updatePreferences(userID: str, preferences: list) -> dict:
    result = (
        supabase.table("users")
        .update({"sector_preferences": preferences})
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return _strip_hash(result.data[0])


async def logout(sessionToken: str) -> bool:
    return await invalidateSession(sessionToken)
