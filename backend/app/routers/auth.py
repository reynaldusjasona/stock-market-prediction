from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import supabase
from app.core.email import sendConfirmationEmail
from app.core.security import hashPassword
from app.services.auth_service import (
    deleteAccountAndData,
    getDeleteConfirm,
    getInvestorRecordForEdit,
    getPreferences,
    getRiskTolerance,
    getUserDetails,
    invalidateSession,
    login as svcLogin,
    logout as svcLogout,
    savePreferences,
    updateAccount,
    updatePreferences,
    updateRecommendations,
    updateRiskTolerance,
    validateFormInput,
    validateInputs,
)

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    sectors: Optional[List[str]] = []
    level: Optional[str] = "moderate"


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

    hashed = hashPassword(body.password)
    insert_result = (
        supabase.table("users")
        .insert(
            {
                "name": body.name,
                "email": body.email,
                "password_hash": hashed,
                "role": "investor",
                "status": "active",
            }
        )
        .execute()
    )
    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Registration failed")

    user_id = insert_result.data[0]["id"]

    await savePreferences(user_id, body.sectors or [], body.level or "moderate")
    await sendConfirmationEmail(body.email, body.name)

    return {"message": "Registration successful", "user_id": user_id}


@router.post("/auth/login", tags=["Auth"])
async def loginEndpoint(body: LoginRequest):
    return await svcLogin(body.email, body.password)


@router.get("/auth/user/{investorID}", tags=["Auth"])
async def getUser(investorID: str):
    return await getUserDetails(investorID)


@router.get("/auth/user/{investorID}/edit", tags=["Auth"])
async def getEditForm(investorID: str):
    return await getInvestorRecordForEdit(investorID)


@router.put("/auth/user/{investorID}", tags=["Auth"])
async def updateUser(investorID: str, body: UpdateAccountRequest):
    form_data: dict = {}
    if body.name is not None:
        form_data["name"] = body.name
    if body.password is not None:
        form_data["password"] = body.password

    validation = await validateFormInput(form_data)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["error"])

    return await updateAccount(investorID, body.name or "", body.password or "")


@router.delete("/auth/user/{userID}", tags=["Auth"])
async def deleteUser(userID: str):
    user = await getDeleteConfirm(userID)
    session_token = user.get("session_token")
    await deleteAccountAndData(userID)
    if session_token:
        await invalidateSession(session_token)
    return {"message": "Account deleted"}


@router.get("/auth/user/{userID}/risk-tolerance", tags=["Auth"])
async def getRisk(userID: str):
    return await getRiskTolerance(userID)


@router.put("/auth/user/{userID}/risk-tolerance", tags=["Auth"])
async def updateRisk(userID: str, body: RiskToleranceRequest):
    updated = await updateRiskTolerance(userID, body.level)
    await updateRecommendations(userID)
    return updated


@router.get("/auth/user/{userID}/preferences", tags=["Auth"])
async def getPrefs(userID: str):
    return await getPreferences(userID)


@router.put("/auth/user/{userID}/preferences", tags=["Auth"])
async def updatePrefs(userID: str, body: PreferencesRequest):
    updated = await updatePreferences(userID, body.preferences)
    await updateRecommendations(userID)
    return updated


@router.post("/auth/logout", tags=["Auth"])
async def logoutEndpoint(body: LogoutRequest):
    await svcLogout(body.session_token)
    return {"message": "Logged out successfully"}
