from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.services.admin_service import (
    approveTrader,
    createApiSource,
    deleteApiSource,
    dismissAlert,
    getActivityLogs,
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
    searchUserByKeywords,
    suspendAccount as svcSuspendAccount,
    updateApiSource,
    updateLandingContent,
    updateUserDetails as svcUpdateUserDetails,
    validatePermission,
)


router = APIRouter()


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


class LandingSectionUpdate(BaseModel):
    section_key: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = None
    is_visible: Optional[bool] = None


class UpdateLandingRequest(BaseModel):
    sections: list[LandingSectionUpdate]


class ApiSourceCreate(BaseModel):
    name: str
    base_url: Optional[str] = None
    api_key_masked: Optional[str] = None
    rate_limit: Optional[str] = None
    is_enabled: bool = True
    status: str = "active"


class ApiSourceUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key_masked: Optional[str] = None
    rate_limit: Optional[str] = None
    is_enabled: Optional[bool] = None
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
        userID, body.role or "", body.status or ""
    )


@router.patch("/admin/users/{userID}/suspend", tags=["Admin"])
async def suspendAccount(
    userID: str,
    current_user: dict = Depends(_require_admin),
):
    adminID = current_user.get("sub")
    return await svcSuspendAccount(adminID, userID)


@router.patch("/admin/users/{userID}/approve-trader", tags=["Admin"])
async def approveTraderRoute(
    userID: str,
    current_user: dict = Depends(_require_admin),
):
    return await approveTrader(userID)


@router.patch("/admin/users/{userID}/reject-trader", tags=["Admin"])
async def rejectTraderRoute(
    userID: str,
    current_user: dict = Depends(_require_admin),
):
    return await rejectTrader(userID)


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
    return await requestModelRetrain(adminID)


@router.get("/admin/landing", tags=["Admin"])
async def getLandingContentRoute(
    current_user: dict = Depends(_require_admin),
):
    result = await getLandingContent()
    return {"sections": result}


@router.put("/admin/landing", tags=["Admin"])
async def updateLandingContentRoute(
    body: UpdateLandingRequest,
    current_user: dict = Depends(_require_admin),
):
    adminID = current_user.get("sub")
    sections = [
        s.model_dump(exclude_unset=True) for s in body.sections
    ]
    try:
        result = await updateLandingContent(sections, adminID)
    except Exception:
        raise HTTPException(
            status_code=500, detail="Failed to update landing content"
        )
    return {"sections": result, "message": "Landing content updated"}


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
    return await createApiSource(body.model_dump())


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
    return await updateApiSource(
        source_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/admin/apis/{source_id}", tags=["Admin"])
async def deleteApiSourceRoute(
    source_id: str,
    current_user: dict = Depends(_require_admin),
):
    return await deleteApiSource(source_id)


# ---- PUBLIC (no auth) ----
# admin.py has no other public endpoint, and stocks.py is purely
# stock-domain, so this lives here without _require_admin per the
# fallback rule for routes that don't fit either existing router.
@router.get("/landing", tags=["Public"])
async def getPublicLandingContent():
    result = await getLandingContent()
    visible = [s for s in result if s.get("is_visible", True)]
    return {"sections": visible}
