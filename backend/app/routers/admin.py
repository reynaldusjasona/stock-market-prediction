from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services.admin_service import (
    getAllUserAccount,
    getLatestMetrics,
    getPriceAlerts,
    searchUserByKeywords,
    suspendAccount as svcSuspendAccount,
    updateUserDetails as svcUpdateUserDetails,
    validatePermission,
)


router = APIRouter()


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.put("/admin/users/{userID}", tags=["Admin"])
async def updateUserDetails(
    userID: str,
    body: UpdateUserRequest,
    current_user: dict = Depends(_require_admin),
):
    adminID = current_user.get("sub")
    await validatePermission(adminID)
    return await svcUpdateUserDetails(
        userID, body.role or "", body.status or ""
    )


@router.patch("/admin/users/{userID}/suspend", tags=["Admin"])
async def suspendAccount(
    userID: str,
    current_user: dict = Depends(_require_admin),
):
    adminID = current_user.get("sub")
    return await svcSuspendAccount(adminID, userID)


@router.get("/admin/users/search", tags=["Admin"])
async def searchUserAccount(
    keywords: str,
    current_user: dict = Depends(_require_admin),
):
    return await searchUserByKeywords(keywords)


@router.get("/admin/users", tags=["Admin"])
async def fetchAllUserAccount(
    current_user: dict = Depends(_require_admin),
):
    return await getAllUserAccount()


@router.get("/admin/metrics", tags=["Admin"])
async def getPerformanceMetric(
    current_user: dict = Depends(_require_admin),
):
    return await getLatestMetrics()


@router.get("/admin/alerts", tags=["Admin"])
async def getPriceAlertsRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getPriceAlerts()
