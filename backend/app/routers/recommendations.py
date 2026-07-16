from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_user
from app.services.recommendation_service import (
    getGeneralRecommendations,
    getPersonalizedRecommendations,
)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("")
async def getRecommendations(
    limit: int = Query(default=10, le=50),
):
    result = await getGeneralRecommendations(limit)
    return {"recommendations": result, "count": len(result)}


@router.get("/personalized")
async def getPersonalizedRecommendationsRoute(
    limit: int = Query(default=10, le=50),
    current_user: dict = Depends(get_current_user),
):
    userID = current_user["sub"]
    result = await getPersonalizedRecommendations(userID, limit)
    return {
        "recommendations": result,
        "count": len(result),
        "personalized": True,
    }
