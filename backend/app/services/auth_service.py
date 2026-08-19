import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from app.core.database import supabase
from app.core.email import (
    sendLoginOtpEmail,
    sendPasswordResetEmail,
    sendRegistrationOtpEmail,
    sendVerificationEmail,
)
from app.core.security import createAccessToken, hashPassword, verifyPassword

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
_VALID_LEVELS = {"low", "moderate", "high"}
_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

_RESET_OTP_EXPIRE_MINUTES = 5
_RESET_TOKEN_EXPIRE_MINUTES = 10
_REGISTER_OTP_EXPIRE_MINUTES = 5
_LOGIN_CHALLENGE_EXPIRE_MINUTES = 5
_LOGIN_OTP_EXPIRE_MINUTES = 5

_PUBLIC_FIELDS = (
    "id, name, email, role, status, risk_tolerance, "
    "sector_preferences, created_at, updated_at, "
    "phone, trader_status, license_number, specialization, "
    "years_experience, bio"
)


def _strip_hash(row: dict) -> dict:
    return {k: v for k, v in row.items() if k != "password_hash"}


_PUBLIC_FIELD_SET = {
    "id", "name", "email", "role", "status", "risk_tolerance",
    "sector_preferences", "created_at", "updated_at",
    "phone", "trader_status", "license_number", "specialization",
    "years_experience", "bio", "is_verified",
}


def _to_public(row: dict) -> dict:
    """Return only the fields safe to expose in API responses."""
    return {k: v for k, v in row.items() if k in _PUBLIC_FIELD_SET}


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


async def createAndSendRegistrationOtp(userID: str, name: str, email: str) -> None:
    """Generate and email a registration-verification OTP.

    Stored in register_otp_code / register_otp_expires_at - deliberately
    separate from otp_code/otp_expires_at (admin 2FA) and
    reset_otp_code/reset_otp_expires_at (forgot password), so none of the
    three OTP flows on this table can ever collide on the same account.
    """
    otp_code = await generateOtp()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=_REGISTER_OTP_EXPIRE_MINUTES
    )
    supabase.table("users").update({
        "register_otp_code": otp_code,
        "register_otp_expires_at": expires_at.isoformat(),
        "is_verified": False,
    }).eq("id", userID).execute()

    sent = await sendRegistrationOtpEmail(email, name, otp_code)
    if not sent:
        print(
            f"[register-otp] Failed to send registration OTP email to "
            f"{email}. Fallback code: {otp_code}"
        )


async def verifyRegisterOtp(email: str, otpCode: str) -> dict:
    """Verify a registration OTP and mark the account verified.

    Raises the same generic HTTPException(401) for an unknown email, wrong
    code, or expired code - mirroring verifyResetOtp's non-enumerable
    pattern so this can't be used to probe which emails are registered.
    """
    result = (
        supabase.table("users")
        .select("id, register_otp_code, register_otp_expires_at")
        .eq("email", email)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid or expired code.")

    user = result.data[0]
    stored_code = user.get("register_otp_code")
    expires_at = user.get("register_otp_expires_at")
    if (
        not stored_code
        or stored_code != otpCode
        or not expires_at
        or datetime.fromisoformat(expires_at) <= datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=401, detail="Invalid or expired code.")

    supabase.table("users").update({
        "is_verified": True,
        "register_otp_code": None,
        "register_otp_expires_at": None,
    }).eq("id", user["id"]).execute()
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
    await createAndSendRegistrationOtp(user["id"], user["name"], user["email"])


async def _checkLoginCredentials(identifier: str, password: str) -> dict:
    """Shared credential/eligibility checks used by both login() (admin,
    unchanged - a real token is issued the moment this returns) and the
    investor/trader login-otp flow below (where a token is only issued
    after a second OTP step). Same checks, same order, same exceptions
    either flow already relied on - only what happens AFTER this returns
    differs between the two.
    """
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
    return user


async def login(identifier: str, password: str) -> dict:
    user = await _checkLoginCredentials(identifier, password)
    token = createAccessToken(
        {"sub": user["id"], "email": user["email"], "role": user["role"]}
    )
    supabase.table("users").update(
        {"session_token": token}
    ).eq("id", user["id"]).execute()
    return {"token": token, "user": _to_public(user)}


async def initiateLoginOtp(identifier: str, password: str) -> str:
    """Investor/trader login step 1. Runs the exact same credential and
    eligibility checks as login() via _checkLoginCredentials - but instead
    of issuing a real session token, issues a short-lived opaque
    login_challenge_token and emails an OTP that must be presented
    alongside it in verifyLoginOtp. No usable token is ever returned from
    this step.

    Admin accounts are explicitly rejected here (after the password check
    already succeeded, so this reveals nothing an attacker couldn't already
    infer from having the right password) - admin must keep using the
    existing POST /auth/login + send-2fa/verify-2fa flow untouched. Without
    this check, this endpoint would double as an undocumented way for an
    admin account to log in while completely bypassing admin 2FA, since
    this is a separate OTP mechanism with its own columns.
    """
    user = await _checkLoginCredentials(identifier, password)
    if user.get("role") == "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin accounts must use the standard login flow.",
        )

    challenge_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    challenge_expires_at = now + timedelta(
        minutes=_LOGIN_CHALLENGE_EXPIRE_MINUTES
    )
    otp_code = await generateOtp()
    otp_expires_at = now + timedelta(minutes=_LOGIN_OTP_EXPIRE_MINUTES)

    supabase.table("users").update({
        "login_challenge_token": challenge_token,
        "login_challenge_expires_at": challenge_expires_at.isoformat(),
        "login_otp_code": otp_code,
        "login_otp_expires_at": otp_expires_at.isoformat(),
    }).eq("id", user["id"]).execute()

    sent = await sendLoginOtpEmail(user["email"], otp_code)
    if not sent:
        print(
            f"[login-otp] Failed to send login OTP email to "
            f"{user['email']}. Fallback code: {otp_code}"
        )

    return challenge_token


async def verifyLoginOtp(loginChallenge: str, otpCode: str) -> dict:
    """Investor/trader login step 2. Looked up by login_challenge_token,
    not email - the challenge is already an unguessable secret scoped to
    this one login attempt, so keying off it (rather than requiring the
    client to resend the email) is at least as safe.

    On success, mints the same real session token login() issues today and
    clears both single-use fields. Any failure - unknown/expired challenge,
    wrong code, expired code - raises the same generic HTTPException(401),
    matching verifyResetOtp/verifyRegisterOtp's non-enumerable pattern.
    """
    result = (
        supabase.table("users")
        .select("*")
        .eq("login_challenge_token", loginChallenge)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid or expired code.")

    user = result.data[0]
    now = datetime.now(timezone.utc)
    challenge_expires_at = user.get("login_challenge_expires_at")
    stored_code = user.get("login_otp_code")
    otp_expires_at = user.get("login_otp_expires_at")
    if (
        not challenge_expires_at
        or datetime.fromisoformat(challenge_expires_at) <= now
        or not stored_code
        or stored_code != otpCode
        or not otp_expires_at
        or datetime.fromisoformat(otp_expires_at) <= now
    ):
        raise HTTPException(status_code=401, detail="Invalid or expired code.")

    token = createAccessToken(
        {"sub": user["id"], "email": user["email"], "role": user["role"]}
    )
    # clear the challenge + OTP (single-use) in the same update that grants
    # the real session, so neither can be replayed
    supabase.table("users").update({
        "session_token": token,
        "login_challenge_token": None,
        "login_challenge_expires_at": None,
        "login_otp_code": None,
        "login_otp_expires_at": None,
    }).eq("id", user["id"]).execute()

    return {"token": token, "user": _to_public(user)}


async def generateOtp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


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


async def updateAccount(
    investorID: str,
    name: str,
    password: str,
    phone: Optional[str] = None,
    specialization: Optional[str] = None,
    years_experience: Optional[int] = None,
    bio: Optional[str] = None,
) -> dict:
    updates: dict = {}
    if name:
        updates["name"] = name
    if password:
        updates["password_hash"] = hashPassword(password)
    if phone is not None:
        updates["phone"] = phone
    if specialization is not None:
        updates["specialization"] = specialization
    if years_experience is not None:
        updates["years_experience"] = years_experience
    if bio is not None:
        updates["bio"] = bio
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


async def requestPasswordReset(email: str) -> None:
    """Look up the user and, if they exist and are verified, generate and
    email a reset OTP. Silently no-ops for unknown/unverified emails - the
    router always returns the same generic response either way, so this
    never signals whether the email is registered.

    Stored in reset_otp_code / reset_otp_expires_at - deliberately separate
    columns from otp_code / otp_expires_at (used by admin 2FA), so a
    concurrent login-OTP and forgot-password-OTP on the same account never
    collide or clobber each other.
    """
    result = (
        supabase.table("users")
        .select("id, name, email, is_verified, status")
        .eq("email", email)
        .execute()
    )
    if not result.data:
        return
    user = result.data[0]
    if not user.get("is_verified") or user.get("status") != "active":
        return

    otp_code = await generateOtp()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=_RESET_OTP_EXPIRE_MINUTES
    )
    supabase.table("users").update({
        "reset_otp_code": otp_code,
        "reset_otp_expires_at": expires_at.isoformat(),
    }).eq("id", user["id"]).execute()

    sent = await sendPasswordResetEmail(email, user["name"], otp_code)
    if not sent:
        print(
            f"[forgot-password] Failed to send reset OTP email to {email}. "
            f"Fallback code: {otp_code}"
        )


async def verifyResetOtp(email: str, otpCode: str) -> str:
    """Verify a forgot-password OTP and issue a short-lived, purpose-scoped
    reset token. Raises HTTPException(401) on any invalid/expired/unknown
    input - deliberately the same generic error for "no such email",
    "wrong code", and "expired code" so this can't be used to enumerate
    registered emails either.

    The reset token is a random opaque string stored on the user row
    (reset_token / reset_token_expires_at), NOT a login JWT - it only
    grants access to resetPasswordWithToken below, nothing else.
    """
    result = (
        supabase.table("users")
        .select("id, reset_otp_code, reset_otp_expires_at")
        .eq("email", email)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid or expired code.")

    user = result.data[0]
    stored_code = user.get("reset_otp_code")
    expires_at = user.get("reset_otp_expires_at")
    if (
        not stored_code
        or stored_code != otpCode
        or not expires_at
        or datetime.fromisoformat(expires_at) <= datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=401, detail="Invalid or expired code.")

    reset_token = secrets.token_urlsafe(32)
    token_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=_RESET_TOKEN_EXPIRE_MINUTES
    )
    # clear the OTP (single-use) and store the new reset token in the same
    # update, so a code can never be replayed to mint a second token
    supabase.table("users").update({
        "reset_otp_code": None,
        "reset_otp_expires_at": None,
        "reset_token": reset_token,
        "reset_token_expires_at": token_expires_at.isoformat(),
    }).eq("id", user["id"]).execute()

    return reset_token


async def resetPasswordWithToken(resetToken: str, newPassword: str) -> dict:
    result = (
        supabase.table("users")
        .select("id, reset_token_expires_at")
        .eq("reset_token", resetToken)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=401, detail="Invalid or expired reset link."
        )

    user = result.data[0]
    expires_at = user.get("reset_token_expires_at")
    if not expires_at or datetime.fromisoformat(expires_at) <= datetime.now(
        timezone.utc
    ):
        raise HTTPException(
            status_code=401, detail="Invalid or expired reset link."
        )

    if len(newPassword) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 8 characters",
        )

    hashed = hashPassword(newPassword)
    supabase.table("users").update({
        "password_hash": hashed,
        "reset_token": None,
        "reset_token_expires_at": None,
    }).eq("id", user["id"]).execute()
    return {"message": "Password reset successful"}
