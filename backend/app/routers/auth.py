from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import supabase
from app.core.email import sendConfirmationEmail
from app.core.security import hashPassword
from app.services.auth_service import (
    deleteAccountAndData,
    getDeleteConfirm,
    getInvestorRecordForEdit as svcGetInvestorRecordForEdit,
    getPreferences as svcGetPreferences,
    getRiskTolerance as svcGetRiskTolerance,
    getUserDetails as svcGetUserDetails,
    invalidateSession,
    login as svcLogin,
    logout as svcLogout,
    savePreferences,
    updateAccount as svcUpdateAccount,
    updatePreferences as svcUpdatePreferences,
    updateRecommendations,
    updateRiskTolerance as svcUpdateRiskTolerance,
    validateFormInput,
    validateInputs,
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


class LoginRequest(BaseModel):
    email: str
    password: str


class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None


class RiskToleranceRequest(BaseModel):
    level: str


class PreferencesRequest(BaseModel):
    preferences: List[str]


class LogoutRequest(BaseModel):
    session_token: str


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

    role = body.role if body.role in _VALID_SELF_REGISTER_ROLES else "investor"

    hashed = hashPassword(body.password)
    insert_result = (
        supabase.table("users")
        .insert(
            {
                "name": body.name,
                "email": body.email,
                "password_hash": hashed,
                "role": role,
                "status": "active",
            }
        )
        .execute()
    )
    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Registration failed")

    user_id = insert_result.data[0]["id"]

    await savePreferences(
        user_id, body.sectors or [], body.level or "moderate"
    )
    await sendConfirmationEmail(body.email, body.name)

    return {"message": "Registration successful", "user_id": user_id}


@router.post("/auth/login", tags=["Auth"])
async def login(body: LoginRequest):
    return await svcLogin(body.email, body.password)


@router.get("/auth/user/{investorID}", tags=["Auth"])
async def getUserDetails(investorID: str):
    return await svcGetUserDetails(investorID)


@router.get("/auth/user/{investorID}/edit", tags=["Auth"])
async def getInvestorRecordForEdit(investorID: str):
    return await svcGetInvestorRecordForEdit(investorID)


@router.put("/auth/user/{investorID}", tags=["Auth"])
async def updateAccount(investorID: str, body: UpdateAccountRequest):
    form_data: dict = {}
    if body.name is not None:
        form_data["name"] = body.name
    if body.password is not None:
        form_data["password"] = body.password

    validation = await validateFormInput(form_data)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["error"])

    return await svcUpdateAccount(
        investorID, body.name or "", body.password or ""
    )


@router.delete("/auth/user/{userID}", tags=["Auth"])
async def deleteAccount(userID: str):
    user = await getDeleteConfirm(userID)
    session_token = user.get("session_token")
    await deleteAccountAndData(userID)
    if session_token:
        await invalidateSession(session_token)
    return {"message": "Account deleted"}


@router.get("/auth/user/{userID}/risk-tolerance", tags=["Auth"])
async def getRiskTolerance(userID: str):
    return await svcGetRiskTolerance(userID)


@router.put("/auth/user/{userID}/risk-tolerance", tags=["Auth"])
async def updateRiskTolerance(userID: str, body: RiskToleranceRequest):
    updated = await svcUpdateRiskTolerance(userID, body.level)
    await updateRecommendations(userID)
    return updated


@router.get("/auth/user/{userID}/preferences", tags=["Auth"])
async def getPreferences(userID: str):
    return await svcGetPreferences(userID)


@router.put("/auth/user/{userID}/preferences", tags=["Auth"])
async def updatePreferences(userID: str, body: PreferencesRequest):
    updated = await svcUpdatePreferences(userID, body.preferences)
    await updateRecommendations(userID)
    return updated


@router.post("/auth/logout", tags=["Auth"])
async def logout(body: LogoutRequest):
    await svcLogout(body.session_token)
    return {"message": "Logged out successfully"}
