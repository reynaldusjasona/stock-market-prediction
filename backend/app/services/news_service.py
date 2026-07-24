
from datetime import datetime, timedelta, timezone

from app.core.api_clients import finnhubGet
from app.core.database import supabase
from ml.training.build_sentiment_features import assign_to_trading_session


async def getStockNews(
    stock: str,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list:
    """
    This functions fetch news articles for a ticker.

    Each article's session_date is computed and stored
    with published_at, headline, summary, source, url,
    and ticker in the news_articles table.
    """
    if from_date is None or to_date is None:
        today = datetime.now(timezone.utc).date()
        from_date = from_date or (today - timedelta(days=7)).strftime("%Y-%m-%d")
        to_date = to_date or today.strftime("%Y-%m-%d")

    raw = await finnhubGet(
        "company-news",
        {"symbol": stock, "from": from_date, "to": to_date},
    )
    if not isinstance(raw, list):
        return []

    articles = []
    rows = []
    for item in raw:
        published_at_dt = datetime.fromtimestamp(
            item.get("datetime", 0), tz=timezone.utc
        )
        published_at = published_at_dt.isoformat()
        session_date = assign_to_trading_session(published_at_dt).date().isoformat()

        article = {
            "ticker": stock,
            "headline": item.get("headline", ""),
            "summary": item.get("summary", ""),
            "source": item.get("source", ""),
            "url": item.get("url", ""),
            "published_at": published_at,
            "session_date": session_date,
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


async def getSentimentScore(
    stock: str,
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict:
    """
    Return cached sentiment for a ticker/date range. Fetches raw
    articles, then reads back scores.

    If none of the fetched articles have been scored yet, returns
    sentiment_label="Pending" and sentiment_score=None
    """
    articles = await getStockNews(stock, from_date=from_date, to_date=to_date)
    urls = [a["url"] for a in articles if a.get("url")]

    if not urls:
        return {
            "ticker": stock,
            "sentiment_score": None,
            "sentiment_label": "Pending",
            "article_count": 0,
        }

    response = (
        supabase.table("news_articles")
        .select("sentiment_score")
        .in_("url", urls)
        .not_.is_("sentiment_score", "null")
        .execute()
    )
    scores = [row["sentiment_score"] for row in (response.data or [])]

    if not scores:
        return {
            "ticker": stock,
            "sentiment_score": None,
            "sentiment_label": "Pending",
            "article_count": len(articles),
        }

    avg = sum(scores) / len(scores)
    if avg > 0.05:
        label = "Positive"
    elif avg < -0.05:
        label = "Negative"
    else:
        label = "Neutral"

    return {
        "ticker": stock,
        "sentiment_score": avg,
        "sentiment_label": label,
        "article_count": len(articles),
        "scored_count": len(scores),
    }


async def getDailySentiment(stock: str, from_date: str, to_date: str) -> list[dict]:
    """
    This functions is for the ML training pipeline.

    It fetches raw articles, then reads back cached scores grouped
    by session_date.

    Returns a list of dicts with keys: date, sentiment_mean, sentiment_std, news_count.
    """
    articles = await getStockNews(stock, from_date=from_date, to_date=to_date)
    urls = [a["url"] for a in articles if a.get("url")]
    session_by_url = {a["url"]: a["session_date"] for a in articles if a.get("url")}

    if not urls:
        return []

    response = (
        supabase.table("news_articles")
        .select("url, sentiment_score")
        .in_("url", urls)
        .not_.is_("sentiment_score", "null")
        .execute()
    )

    by_date: dict[str, list[float]] = {}
    for row in (response.data or []):
        session_date = session_by_url.get(row["url"])
        if session_date is None:
            continue
        by_date.setdefault(session_date, []).append(row["sentiment_score"])

    results = []
    for session_date, day_scores in sorted(by_date.items()):
        n = len(day_scores)
        mean = sum(day_scores) / n
        variance = sum((s - mean) ** 2 for s in day_scores) / n if n > 1 else 0.0
        results.append({
            "date": session_date,
            "sentiment_mean": mean,
            "sentiment_std": variance ** 0.5,
            "news_count": n,
        })

    return results
