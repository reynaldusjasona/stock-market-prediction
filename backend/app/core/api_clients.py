import os

import httpx
from dotenv import load_dotenv

load_dotenv()

_FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")
_TWELVE_KEY = os.getenv("TWELVE_DATA_API_KEY", "")
_AV_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "")

_FINNHUB_BASE = "https://finnhub.io/api/v1"
_TWELVE_BASE = "https://api.twelvedata.com"
_AV_BASE = "https://www.alphavantage.co/query"


async def finnhubGet(endpoint: str, params: dict) -> dict:
    url = f"{_FINNHUB_BASE}/{endpoint}"
    merged = {**params, "token": _FINNHUB_KEY}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=merged)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as exc:
        return {
            "error": exc.response.text,
            "status_code": exc.response.status_code,
        }
    except Exception as exc:
        return {"error": str(exc)}


async def twelveDataGet(endpoint: str, params: dict) -> dict:
    url = f"{_TWELVE_BASE}/{endpoint}"
    merged = {**params, "apikey": _TWELVE_KEY}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=merged)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as exc:
        return {
            "error": exc.response.text,
            "status_code": exc.response.status_code,
        }
    except Exception as exc:
        return {"error": str(exc)}


async def alphaVantageGet(params: dict) -> dict:
    merged = {**params, "apikey": _AV_KEY}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(_AV_BASE, params=merged)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as exc:
        return {
            "error": exc.response.text,
            "status_code": exc.response.status_code,
        }
    except Exception as exc:
        return {"error": str(exc)}
