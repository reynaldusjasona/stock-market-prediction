from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import supabase
from app.core.email import sendOtpEmail
from app.core.rate_limit import checkRateLimit
from app.core.security import get_current_user, hashPassword
from app.services.activity_service import logActivity
from app.services.auth_service import (
    changePassword,
    createAndSendRegistrationOtp,
    deleteAccountAndData,
    generateOtp,
    getDeleteConfirm,
    getInvestorRecordForEdit as svcGetInvestorRecordForEdit,
    getPreferences as svcGetPreferences,
    getRiskTolerance as svcGetRiskTolerance,
    getUserDetails as svcGetUserDetails,
    initiateLoginOtp,
    invalidateSession,
    login as svcLogin,
    logout as svcLogout,
    requestPasswordReset,
    resendVerification as svcResendVerification,
    resetPasswordWithToken as svcResetPasswordWithToken,
    saveOtp,
    savePreferences,
    updateAccount as svcUpdateAccount,
    updatePreferences as svcUpdatePreferences,
    updateRecommendations,
    updateRiskTolerance as svcUpdateRiskTolerance,
    validateFormInput,
    validateInputs,
    verifyEmailToken as svcVerifyEmailToken,
    verifyLoginOtp as svcVerifyLoginOtp,
    verifyOtp,
    verifyRegisterOtp as svcVerifyRegisterOtp,
    verifyResetOtp as svcVerifyResetOtp,
)

router = APIRouter()


_VALID_SELF_REGISTER_ROLES = {"investor", "trader"}


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    sectors: Optional[List[str]] = []
    level: Optional[str] = "moderate"
    role: Optional[str] = "investor"
    license_number: Optional[str] = None
    phone: Optional[str] = None
    specialization: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class SendTwoFactorRequest(BaseModel):
    email: str


class VerifyTwoFactorRequest(BaseModel):
    email: str
    otp_code: str


class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    specialization: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None


class RiskToleranceRequest(BaseModel):
    level: str


class PreferencesRequest(BaseModel):
    preferences: List[str]


class LogoutRequest(BaseModel):
    session_token: str


class ResendVerificationRequest(BaseModel):
    email: str


class VerifyRegisterOtpRequest(BaseModel):
    email: str
    code: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyResetOtpRequest(BaseModel):
    email: str
    code: str


class ResetPasswordWithTokenRequest(BaseModel):
    reset_token: str
    new_password: str


class RequestLoginOtpRequest(BaseModel):
    email: str
    password: str


class VerifyLoginOtpRequest(BaseModel):
    login_challenge: str
    code: str


@router.post("/auth/register", tags=["Auth"])
async def register(body: RegisterRequest):
    validation = await validateInputs(body.name, body.email, body.password)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["error"])

    existing = (
        supabase.table("users").select("id").eq("email", body.email).execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    if body.role not in _VALID_SELF_REGISTER_ROLES:
        raise HTTPException(
            status_code=400, detail="Role must be 'investor' or 'trader'"
        )
    role = body.role

    hashed = hashPassword(body.password)
    insert_data = {
        "name": body.name,
        "email": body.email,
        "password_hash": hashed,
        "role": role,
        "status": "active",
    }

    if body.phone is not None:
        insert_data["phone"] = body.phone
    if body.specialization is not None:
        insert_data["specialization"] = body.specialization
    if body.years_experience is not None:
        insert_data["years_experience"] = body.years_experience
    if body.bio is not None:
        insert_data["bio"] = body.bio

    if role == "trader":
        if not body.license_number or not body.license_number.strip():
            raise HTTPException(
                status_code=400,
                detail="License number is required for trader registration",
            )
        insert_data["trader_status"] = "pending"
        insert_data["license_number"] = body.license_number

    insert_result = supabase.table("users").insert(insert_data).execute()
    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Registration failed")

    user_id = insert_result.data[0]["id"]

    await savePreferences(
        user_id, body.sectors or [], body.level or "moderate"
    )
    await createAndSendRegistrationOtp(user_id, body.name, body.email)

    return {"message": "Registration successful", "user_id": user_id}


@router.post("/auth/login", tags=["Auth"])
async def login(body: LoginRequest):
    if not checkRateLimit(
        "login", body.email, max_count=5, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again later.",
        )
    result = await svcLogin(body.email, body.password)
    await logActivity(
        userID=result["user"]["id"], action="login", targetType="auth"
    )
    return result


@router.post("/auth/request-login-otp", tags=["Auth"])
async def requestLoginOtp(body: RequestLoginOtpRequest):
    if not checkRateLimit(
        "request-login-otp", body.email, max_count=5, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
        )
    login_challenge = await initiateLoginOtp(body.email, body.password)
    return {
        "login_challenge": login_challenge,
        "message": "Enter the code we sent to your email",
    }


@router.post("/auth/verify-login-otp", tags=["Auth"])
async def verifyLoginOtpRoute(body: VerifyLoginOtpRequest):
    if not checkRateLimit(
        "verify-login-otp", body.login_challenge, max_count=5, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
        )
    result = await svcVerifyLoginOtp(body.login_challenge, body.code)
    await logActivity(
        userID=result["user"]["id"], action="login", targetType="auth"
    )
    return result


@router.post("/auth/send-2fa", tags=["Auth"])
async def sendTwoFactorCode(body: SendTwoFactorRequest):
    if not checkRateLimit(
        "send-2fa", body.email, max_count=3, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
        )
    user_result = (
        supabase.table("users")
        .select("id, role")
        .eq("email", body.email)
        .execute()
    )
    if not user_result.data or user_result.data[0].get("role") != "admin":
        raise HTTPException(status_code=400, detail="Invalid request.")

    otp_code = await generateOtp()
    await saveOtp(body.email, otp_code)
    sent = await sendOtpEmail(body.email, otp_code)
    if not sent:
        print(
            f"[2fa] Failed to send OTP email to {body.email}. "
            f"Fallback code: {otp_code}"
        )
    return {"message": "Verification code sent to your email."}


@router.post("/auth/verify-2fa", tags=["Auth"])
async def verifyTwoFactorCode(body: VerifyTwoFactorRequest):
    if not checkRateLimit(
        "verify-2fa", body.email, max_count=5, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
        )
    verified = await verifyOtp(body.email, body.otp_code)
    if not verified:
        raise HTTPException(
            status_code=401, detail="Invalid or expired verification code."
        )
    return {"verified": True, "message": "2FA verification successful."}


@router.get("/auth/verify/{token}", tags=["Auth"])
async def verifyEmail(token: str):
    return await svcVerifyEmailToken(token)


@router.post("/auth/resend-verification", tags=["Auth"])
async def resendVerification(body: ResendVerificationRequest):
    if not checkRateLimit(
        "resend-verification", body.email, max_count=3, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
        )
    await svcResendVerification(body.email)
    return {
        "message": "If the email exists and is not verified, "
        "a new verification code has been sent."
    }


@router.post("/auth/verify-register-otp", tags=["Auth"])
async def verifyRegisterOtpRoute(body: VerifyRegisterOtpRequest):
    if not checkRateLimit(
        "verify-register-otp", body.email, max_count=5, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
        )
    return await svcVerifyRegisterOtp(body.email, body.code)


@router.post("/auth/reset-password", tags=["Auth"])
async def resetPasswordRoute(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    return await changePassword(
        userID, body.old_password, body.new_password
    )


@router.post("/auth/forgot-password", tags=["Auth"])
async def forgotPassword(body: ForgotPasswordRequest):
    # Rate-limited (and, when allowed, executed) before we know whether the
    # email is even registered - requestPasswordReset silently no-ops for
    # unknown/unverified emails, and the response below is identical either
    # way, so nothing here ever reveals which emails exist.
    if not checkRateLimit(
        "forgot-password", body.email, max_count=3, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
        )
    await requestPasswordReset(body.email)
    return {
        "message": "If that email is registered and verified, "
        "a password reset code has been sent."
    }


@router.post("/auth/verify-reset-otp", tags=["Auth"])
async def verifyResetOtpRoute(body: VerifyResetOtpRequest):
    if not checkRateLimit(
        "verify-reset-otp", body.email, max_count=5, window_minutes=15
    ):
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
        )
    reset_token = await svcVerifyResetOtp(body.email, body.code)
    return {"reset_token": reset_token}


@router.post("/auth/reset-password-with-token", tags=["Auth"])
async def resetPasswordWithTokenRoute(body: ResetPasswordWithTokenRequest):
    return await svcResetPasswordWithToken(body.reset_token, body.new_password)


@router.get("/auth/user/{investorID}", tags=["Auth"])
async def getUserDetails(
    investorID: str,
    current_user: dict = Depends(get_current_user),
):
    if investorID != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await svcGetUserDetails(investorID)


@router.get("/auth/user/{investorID}/edit", tags=["Auth"])
async def getInvestorRecordForEdit(
    investorID: str,
    current_user: dict = Depends(get_current_user),
):
    if investorID != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await svcGetInvestorRecordForEdit(investorID)


@router.put("/auth/user/{investorID}", tags=["Auth"])
async def updateAccount(
    investorID: str,
    body: UpdateAccountRequest,
    current_user: dict = Depends(get_current_user),
):
    if investorID != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    form_data: dict = {}
    if body.name is not None:
        form_data["name"] = body.name
    if body.password is not None:
        form_data["password"] = body.password

    validation = await validateFormInput(form_data)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["error"])

    return await svcUpdateAccount(
        investorID,
        body.name or "",
        body.password or "",
        phone=body.phone,
        specialization=body.specialization,
        years_experience=body.years_experience,
        bio=body.bio,
    )


@router.delete("/auth/user/{userID}", tags=["Auth"])
async def deleteAccount(
    userID: str,
    current_user: dict = Depends(get_current_user),
):
    if userID != current_user["sub"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    user = await getDeleteConfirm(userID)
    session_token = user.get("session_token")
    await deleteAccountAndData(userID)
    if session_token:
        await invalidateSession(session_token)
    actingUserID = current_user["sub"]
    await logActivity(
        userID=actingUserID,
        action="user_deleted",
        targetType="user",
        targetId=userID,
    )
    return {"message": "Account deleted"}


@router.get("/auth/user/{userID}/risk-tolerance", tags=["Auth"])
async def getRiskTolerance(
    userID: str,
    current_user: dict = Depends(get_current_user),
):
    if userID != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await svcGetRiskTolerance(userID)


@router.put("/auth/user/{userID}/risk-tolerance", tags=["Auth"])
async def updateRiskTolerance(
    userID: str,
    body: RiskToleranceRequest,
    current_user: dict = Depends(get_current_user),
):
    if userID != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    updated = await svcUpdateRiskTolerance(userID, body.level)
    await updateRecommendations(userID)
    return updated


@router.get("/auth/user/{userID}/preferences", tags=["Auth"])
async def getPreferences(
    userID: str,
    current_user: dict = Depends(get_current_user),
):
    if userID != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await svcGetPreferences(userID)


@router.put("/auth/user/{userID}/preferences", tags=["Auth"])
async def updatePreferences(
    userID: str,
    body: PreferencesRequest,
    current_user: dict = Depends(get_current_user),
):
    if userID != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    updated = await svcUpdatePreferences(userID, body.preferences)
    await updateRecommendations(userID)
    return updated


@router.post("/auth/logout", tags=["Auth"])
async def logout(body: LogoutRequest):
    await svcLogout(body.session_token)
    return {"message": "Logged out successfully"}
