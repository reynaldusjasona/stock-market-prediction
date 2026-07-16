from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services.admin_service import (
    dismissAlert,
    getActivityLogs,
    getAlertsSummary,
    getAllUserAccount,
    getDashboardStats,
    getFeedbackById,
    getLatestMetrics,
    getModelConfig,
    getModelPerformance,
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


@router.get("/admin/activity-log", tags=["Admin"])
async def getActivityLog(
    page: int = 1,
    limit: int = 20,
    action: Optional[str] = None,
    current_user: dict = Depends(_require_admin),
):
    return await getActivityLogs(page, limit, action)


@router.get("/admin/stats", tags=["Admin"])
async def getDashboardStatsRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getDashboardStats()


@router.get("/admin/model/performance", tags=["Admin"])
async def getModelPerformanceRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getModelPerformance()


@router.get("/admin/model/config", tags=["Admin"])
async def getModelConfigRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getModelConfig()


@router.get("/admin/feedback/{feedback_id}", tags=["Admin"])
async def getFeedbackByIdRoute(
    feedback_id: str,
    current_user: dict = Depends(_require_admin),
):
    result = await getFeedbackById(feedback_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return result


@router.get("/admin/alerts/summary", tags=["Admin"])
async def getAlertsSummaryRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getAlertsSummary()


@router.patch("/admin/alerts/{alert_id}/dismiss", tags=["Admin"])
async def dismissAlertRoute(
    alert_id: str,
    current_user: dict = Depends(_require_admin),
):
    result = await dismissAlert(alert_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert dismissed", "alert": result}
