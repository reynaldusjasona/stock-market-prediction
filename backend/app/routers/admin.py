from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services.activity_service import logActivity
from app.services.admin_service import (
    approveTrader,
    buildPublicLandingSections,
    createApiSource,
    deleteApiSource,
    dismissAlert,
    getActivityLogs,
    getAdminAlerts,
    getAdminAlertsSummary,
    getAlertsSummary,
    getAllUserAccount,
    getApiSourceById,
    getApiSources,
    getDashboardStats,
    getFeedbackById,
    getLandingContent,
    getLatestMetrics,
    getModelConfig,
    getModelPerformance,
    getModelQuality,
    getPriceAlerts,
    getRetrainStatus,
    rejectTrader,
    requestModelRetrain,
    resolveAdminAlert,
    searchUserByKeywords,
    suspendAccount as svcSuspendAccount,
    unsuspendAccount as svcUnsuspendAccount,
    updateApiSource,
    updateLandingContent,
    updateUserDetails as svcUpdateUserDetails,
    validatePermission,
    verifyLicense,
)


router = APIRouter()


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None


class ApiSourceCreate(BaseModel):
    name: str
    base_url: Optional[str] = None
    api_key_masked: Optional[str] = None
    rate_limit: Optional[str] = None
    api_type: Optional[str] = "REST"
    description: Optional[str] = None
    is_enable: bool = True
    status: str = "active"


class ApiSourceUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key_masked: Optional[str] = None
    rate_limit: Optional[str] = None
    api_type: Optional[str] = None
    description: Optional[str] = None
    is_enable: Optional[bool] = None
    status: Optional[str] = None

    model_config = {"extra": "forbid"}


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
        userID,
        body.role or "",
        body.status or "",
        body.name or "",
        body.email or "",
    )


@router.patch("/admin/users/{userID}/suspend", tags=["Admin"])
async def suspendAccount(
    userID: str,
    current_user: dict = Depends(_require_admin),
):
    adminID = current_user.get("sub")
    result = await svcSuspendAccount(adminID, userID)
    await logActivity(
        userID=adminID,
        action="user_suspended",
        targetType="user",
        targetId=userID,
    )
    return result


@router.patch("/admin/users/{userID}/unsuspend", tags=["Admin"])
async def unsuspendAccount(
    userID: str,
    current_user: dict = Depends(_require_admin),
):
    adminID = current_user.get("sub")
    result = await svcUnsuspendAccount(userID)
    await logActivity(
        userID=adminID,
        action="user_unsuspended",
        targetType="user",
        targetId=userID,
    )
    return result


@router.patch("/admin/users/{userID}/approve-trader", tags=["Admin"])
async def approveTraderRoute(
    userID: str,
    current_user: dict = Depends(_require_admin),
):
    result = await approveTrader(userID)
    adminID = current_user.get("sub")
    await logActivity(
        userID=adminID,
        action="trader_approved",
        targetType="user",
        targetId=userID,
    )
    return result


@router.patch("/admin/users/{userID}/reject-trader", tags=["Admin"])
async def rejectTraderRoute(
    userID: str,
    current_user: dict = Depends(_require_admin),
):
    result = await rejectTrader(userID)
    adminID = current_user.get("sub")
    await logActivity(
        userID=adminID,
        action="trader_rejected",
        targetType="user",
        targetId=userID,
    )
    return result


@router.get("/admin/verify-license", tags=["Admin"])
async def verifyLicenseRoute(
    number: str,
    current_user: dict = Depends(_require_admin),
):
    return await verifyLicense(number)


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
    q: Optional[str] = None,
    current_user: dict = Depends(_require_admin),
):
    return await getActivityLogs(page, limit, action, q)


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


@router.get("/admin/model/quality", tags=["Admin"])
async def getModelQualityRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getModelQuality()


@router.get("/admin/model/retrain/status", tags=["Admin"])
async def getRetrainStatusRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getRetrainStatus()


@router.post("/admin/model/retrain", tags=["Admin"])
async def requestModelRetrainRoute(
    current_user: dict = Depends(_require_admin),
):
    adminID = current_user.get("sub")
    result = await requestModelRetrain(adminID)
    await logActivity(
        userID=adminID,
        action="model_retrain_requested",
        targetType="model",
    )
    return result


@router.get("/admin/landing", tags=["Admin"])
async def getLandingContentRoute(
    current_user: dict = Depends(_require_admin),
):
    result = await getLandingContent()
    return result


@router.put("/admin/landing", tags=["Admin"])
async def updateLandingContentRoute(
    body: dict = Body(...),
    current_user: dict = Depends(_require_admin),
):
    adminID = current_user.get("sub")
    result = await updateLandingContent(body, adminID)
    await logActivity(
        userID=adminID,
        action="landing_updated",
        targetType="landing_page_config",
    )
    return {"message": "Landing page updated", "content": result}


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
    adminID = current_user.get("sub")
    await logActivity(
        userID=adminID,
        action="alert_dismissed",
        targetType="alert",
        targetId=alert_id,
    )
    return {"message": "Alert dismissed", "alert": result}


@router.get("/admin/platform-alerts", tags=["Admin"])
async def getPlatformAlertsRoute(
    current_user: dict = Depends(_require_admin),
):
    result = await getAdminAlerts()
    return {"alerts": result}


@router.get("/admin/platform-alerts/summary", tags=["Admin"])
async def getPlatformAlertsSummaryRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getAdminAlertsSummary()


@router.patch("/admin/platform-alerts/{alertID}/resolve", tags=["Admin"])
async def resolvePlatformAlertRoute(
    alertID: str,
    current_user: dict = Depends(_require_admin),
):
    result = await resolveAdminAlert(alertID)
    adminID = current_user.get("sub")
    await logActivity(
        userID=adminID,
        action="platform_alert_resolved",
        targetType="admin_alert",
        targetId=alertID,
    )
    return {"message": "Alert resolved", "alert": result}


@router.get("/admin/apis", tags=["Admin"])
async def getApiSourcesRoute(
    current_user: dict = Depends(_require_admin),
):
    return await getApiSources()


@router.post("/admin/apis", tags=["Admin"])
async def createApiSourceRoute(
    body: ApiSourceCreate,
    current_user: dict = Depends(_require_admin),
):
    result = await createApiSource(body.model_dump())
    adminID = current_user.get("sub")
    await logActivity(
        userID=adminID,
        action="api_source_created",
        targetType="api_source",
        targetId=result.get("id"),
    )
    return result


@router.get("/admin/apis/{source_id}", tags=["Admin"])
async def getApiSourceByIdRoute(
    source_id: str,
    current_user: dict = Depends(_require_admin),
):
    return await getApiSourceById(source_id)


@router.patch("/admin/apis/{source_id}", tags=["Admin"])
async def updateApiSourceRoute(
    source_id: str,
    body: ApiSourceUpdate,
    current_user: dict = Depends(_require_admin),
):
    result = await updateApiSource(
        source_id, body.model_dump(exclude_unset=True)
    )
    adminID = current_user.get("sub")
    await logActivity(
        userID=adminID,
        action="api_source_updated",
        targetType="api_source",
        targetId=source_id,
    )
    return result


@router.delete("/admin/apis/{source_id}", tags=["Admin"])
async def deleteApiSourceRoute(
    source_id: str,
    current_user: dict = Depends(_require_admin),
):
    result = await deleteApiSource(source_id)
    adminID = current_user.get("sub")
    await logActivity(
        userID=adminID,
        action="api_source_deleted",
        targetType="api_source",
        targetId=source_id,
    )
    return result


@router.get("/landing", tags=["Public"])
async def getPublicLandingContent():
    content = await getLandingContent()
    return {
        "sections": buildPublicLandingSections(content),
        "testimonials": content.get("testimonials") or [],
    }
