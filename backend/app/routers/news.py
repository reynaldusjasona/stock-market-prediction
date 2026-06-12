from fastapi import APIRouter
import asyncio
from concurrent.futures import ThreadPoolExecutor
import yfinance as yf

<<<<<<< Updated upstream
from app.services import news_service

router = APIRouter(prefix="/news", tags=["News"])


@router.get("/{stock}")
async def getStockNews(stock: str):
    return await news_service.getStockNews(stock)


@router.get("/{stock}/sentiment")
async def getSentimentScore(stock: str):
    return await news_service.getSentimentScore(stock)
=======
router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=5)


def _fetch_news_sync(ticker: str, limit: int) -> list:
    try:
        raw = yf.Ticker(ticker).news or []
        results = []
        for item in raw[:limit]:
            c       = item.get("content", {}) if isinstance(item, dict) else {}
            title   = c.get("title")   or item.get("title",   "")
            summary = c.get("summary") or item.get("summary", "")
            url_obj = c.get("canonicalUrl", {})
            url     = (url_obj.get("url") if isinstance(url_obj, dict) else url_obj) or item.get("link", "")
            prov    = c.get("provider", {})
            source  = (prov.get("displayName") if isinstance(prov, dict) else prov) or item.get("publisher", "")
            pub     = c.get("pubDate") or item.get("providerPublishTime", "")
            thumb   = ""
            t_obj   = c.get("thumbnail") or item.get("thumbnail")
            if isinstance(t_obj, dict):
                rl = t_obj.get("resolutions", [])
                if rl:
                    thumb = rl[0].get("url", "")
            if title:
                results.append({
                    "title":        title,
                    "summary":      summary,
                    "url":          url,
                    "source":       source,
                    "published_at": pub,
                    "thumbnail":    thumb,
                })
        return results
    except Exception:
        return []


@router.get("/news/{ticker}", tags=["News"])
async def get_stock_news(ticker: str, limit: int = 8):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _fetch_news_sync, ticker.upper(), limit)
>>>>>>> Stashed changes
