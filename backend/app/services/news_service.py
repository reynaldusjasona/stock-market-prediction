from datetime import datetime, timedelta, timezone

from app.core.api_clients import finnhubGet
from app.core.database import supabase

_POSITIVE_WORDS = {
    "up", "gain", "rise", "beat", "growth", "profit",
    "surge", "high", "strong", "positive",
}
_NEGATIVE_WORDS = {
    "down", "loss", "fall", "miss", "decline", "weak",
    "drop", "low", "risk", "negative",
}


def _score_text(text: str) -> float:
    words = text.lower().split()
    total = max(len(words), 1)
    pos = sum(1 for w in words if w in _POSITIVE_WORDS)
    neg = sum(1 for w in words if w in _NEGATIVE_WORDS)
    raw = (pos - neg) / total
    return max(-1.0, min(1.0, raw))


async def getStockNews(stock: str) -> list:
    today = datetime.now(timezone.utc).date()
    from_date = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    to_date = today.strftime("%Y-%m-%d")

    raw = await finnhubGet(
        "company-news",
        {"symbol": stock, "from": from_date, "to": to_date},
    )
    if not isinstance(raw, list):
        return []

    articles = []
    rows = []
    for item in raw:
        published_at = datetime.fromtimestamp(
            item.get("datetime", 0), tz=timezone.utc
        ).isoformat()
        article = {
            "ticker": stock,
            "headline": item.get("headline", ""),
            "summary": item.get("summary", ""),
            "source": item.get("source", ""),
            "url": item.get("url", ""),
            "published_at": published_at,
        }
        articles.append(article)
        rows.append({
            **article,
            "sentiment_score": None,
            "sentiment_label": None,
        })

    if rows:
        supabase.table("news_articles").upsert(
            rows, on_conflict="url"
        ).execute()

    return articles


async def getSentimentScore(stock: str) -> dict:
    articles = await getStockNews(stock)

    scores = []
    for article in articles:
        summary = article.get("summary", "")
        if summary:
            scores.append(_score_text(summary))

    n = len(scores)
    avg = sum(scores) / n if n else 0.0

    if avg > 0.05:
        label = "Positive"
    elif avg < -0.05:
        label = "Negative"
    else:
        label = "Neutral"

    for article in articles:
        url = article.get("url")
        if url:
            supabase.table("news_articles").update(
                {"sentiment_score": avg, "sentiment_label": label}
            ).eq("url", url).execute()

    return {
        "ticker": stock,
        "sentiment_score": avg,
        "sentiment_label": label,
        "article_count": len(articles),
    }


async def analyzeSentiment(NewsArticles: list) -> dict:
    scores = []
    for article in NewsArticles:
        summary = article.get("summary", "")
        if summary:
            scores.append(_score_text(summary))

    n = len(scores)
    avg = sum(scores) / n if n else 0.0

    if avg > 0.05:
        label = "Positive"
    elif avg < -0.05:
        label = "Negative"
    else:
        label = "Neutral"

    return {
        "sentiment_score": avg,
        "sentiment_label": label,
        "article_count": len(NewsArticles),
    }

