import os
import random
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.core.database import supabase
from app.core.email import sendVerificationEmail
from app.core.security import createAccessToken, hashPassword, verifyPassword

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
_VALID_LEVELS = {"low", "moderate", "high"}
_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

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
        return {
            "valid": False,
            "error": "Password must be at least 8 characters",
        }
    return {"valid": True}


async def savePreferences(userID: str, sectors: list, level: str) -> dict:
    result = (
        supabase.table("users")
        .update({"sector_preferences": sectors, "risk_tolerance": level})
        .eq("id", userID)
        .execute()
    )
    return result.data[0] if result.data else {}


async def saveVerificationToken(userID: str, token: str) -> dict:
    result = (
        supabase.table("users")
        .update({"verification_token": token, "is_verified": False})
        .eq("id", userID)
        .execute()
    )
    return result.data[0] if result.data else {}


async def createAndSendVerificationEmail(userID: str, name: str, email: str) -> None:
    token = secrets.token_urlsafe(32)
    await saveVerificationToken(userID, token)
    verification_link = f"{_FRONTEND_URL}/verify?token={token}"
    sent = await sendVerificationEmail(email, name, verification_link)
    if not sent:
        print(
            f"[email-verification] Failed to send verification email to "
            f"{email}. Fallback link: {verification_link}"
        )


async def verifyEmailToken(token: str) -> dict:
    result = (
        supabase.table("users")
        .select("id")
        .eq("verification_token", token)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=400, detail="Invalid or expired verification token."
        )
    userID = result.data[0]["id"]
    supabase.table("users").update(
        {"is_verified": True, "verification_token": None}
    ).eq("id", userID).execute()
    return {"message": "Email verified successfully. You can now log in."}


async def resendVerification(email: str) -> None:
    result = (
        supabase.table("users")
        .select("id, name, email, is_verified")
        .eq("email", email)
        .execute()
    )
    if not result.data or result.data[0].get("is_verified"):
        return
    user = result.data[0]
    await createAndSendVerificationEmail(user["id"], user["name"], user["email"])


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
    if not user.get("is_verified", True):
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please check your inbox for the "
            "verification link.",
        )
    if user.get("role") == "trader" and user.get("trader_status") != "approved":
        traderStatus = user.get("trader_status", "pending")
        if traderStatus == "pending":
            raise HTTPException(
                status_code=403,
                detail="Your trader account is pending admin approval. "
                "Please wait for verification.",
            )
        elif traderStatus == "rejected":
            raise HTTPException(
                status_code=403,
                detail="Your trader registration has been rejected. "
                "Please contact support.",
            )
    token = createAccessToken(
        {"sub": user["id"], "email": user["email"], "role": user["role"]}
    )
    supabase.table("users").update(
        {"session_token": token}
    ).eq("id", user["id"]).execute()
    return {"token": token, "user": _strip_hash(user)}


async def generateOtp() -> str:
    return f"{random.randint(0, 999999):06d}"


async def saveOtp(email: str, otpCode: str) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    supabase.table("users").update(
        {"otp_code": otpCode, "otp_expires_at": expires_at.isoformat()}
    ).eq("email", email).execute()


async def verifyOtp(email: str, otpCode: str) -> bool:
    result = (
        supabase.table("users")
        .select("otp_code, otp_expires_at")
        .eq("email", email)
        .execute()
    )
    if not result.data:
        return False
    user = result.data[0]
    if not user.get("otp_code") or user["otp_code"] != otpCode:
        return False
    expires_at = user.get("otp_expires_at")
    if not expires_at or datetime.fromisoformat(expires_at) <= datetime.now(
        timezone.utc
    ):
        return False
    supabase.table("users").update(
        {"otp_code": None, "otp_expires_at": None}
    ).eq("email", email).execute()
    return True


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
        return {
            "valid": False,
            "error": "Password must be at least 8 characters",
        }
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
                status_code=400,
                detail="Level must be one of: low, moderate, high",
            )
        updates["risk_tolerance"] = level
    if "preferences" in data:
        prefs = data["preferences"]
        if not isinstance(prefs, list):
            raise HTTPException(
                status_code=400,
                detail="Preferences must be a list",
            )
        updates["sector_preferences"] = prefs
    if not updates:
        raise HTTPException(
            status_code=400, detail="No valid fields to update"
        )
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


async def changePassword(
    userID: str, oldPassword: str, newPassword: str
) -> dict:
    result = (
        supabase.table("users")
        .select("id, password_hash")
        .eq("id", userID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    user = result.data[0]
    if not verifyPassword(oldPassword, user["password_hash"]):
        raise HTTPException(
            status_code=400, detail="Current password is incorrect"
        )
    if len(newPassword) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 8 characters",
        )
    hashed = hashPassword(newPassword)
    supabase.table("users").update({"password_hash": hashed}).eq(
        "id", userID
    ).execute()
    return {"message": "Password changed successfully"}
