from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth, stocks, predictions, news, alerts, notifications, admin
)

app = FastAPI(
    title="StockWise AI",
    description="FYP 26-S2-26 | Stock Market Web Prediction API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(stocks.router, prefix="/api", tags=["Stocks"])
app.include_router(predictions.router, prefix="/api", tags=["Predictions"])
app.include_router(news.router, prefix="/api", tags=["News"])
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(notifications.router, prefix="/api", tags=["Notifications"])
app.include_router(admin.router, prefix="/api", tags=["Admin"])


@app.get("/")
async def root():
    return {"message": "StockWise AI API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
