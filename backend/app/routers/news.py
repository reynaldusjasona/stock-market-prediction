from fastapi import APIRouter

from app.services import news_service

router = APIRouter(prefix="/news", tags=["News"])


@router.get("/{stock}")
async def getStockNews(stock: str, from_date: str | None = None, to_date: str | None = None):
    return await news_service.getStockNews(stock, from_date=from_date, to_date=to_date)


@router.get("/{stock}/sentiment")
async def getSentimentScore(stock: str, from_date: str | None = None, to_date: str | None = None):
    return await news_service.getSentimentScore(stock, from_date=from_date, to_date=to_date)