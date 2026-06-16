from fastapi import APIRouter
import asyncio
from concurrent.futures import ThreadPoolExecutor
import yfinance as yf

from app.services import news_service

router = APIRouter(prefix="/news", tags=["News"])


@router.get("/{stock}")
async def getStockNews(stock: str):
    return await news_service.getStockNews(stock)


@router.get("/{stock}/sentiment")
async def getSentimentScore(stock: str):
    return await news_service.getSentimentScore(stock)
