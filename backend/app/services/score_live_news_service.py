"""
Score unscored live-news articles stored in Supabase.

This script is intended to be run by GitHub Actions or manually.
It is not called by the FastAPI prediction request, so FinBERT does
not add processing load or latency to Render.
"""

from __future__ import annotations

import argparse
from typing import Any

from app.core.database import supabase
from ml.sentiment_data.build_finbert_pipeline import (
    get_sentiment_label,
    score_headlines,
)


def fetchUnscoredArticles(
    limit: int = 200,
) -> list[dict]:
    response = (
        supabase
        .table("news_articles")
        .select("url, headline")
        .is_("sentiment_score", "null")
        .not_.is_("headline", "null")
        .limit(limit)
        .execute()
    )

    return response.data or []


def updateArticleSentiment(
    url: str,
    score: float,
) -> None:
    """
    Save one article's FinBERT score and label to Supabase.
    """
    (
        supabase
        .table("news_articles")
        .update({
            "sentiment_score": float(score),
            "sentiment_label": get_sentiment_label(score),
        })
        .eq("url", url)
        .execute()
    )


def scoreArticleBatch(
    articles: list[dict[str, Any]],
    model_batch_size: int = 128,
) -> tuple[int, int]:
    """
    Score one article batch.

    Returns:
        A tuple containing updated_count and failed_count.
    """
    if not articles:
        return 0, 0

    headlines = [
        str(article.get("headline") or "").strip()
        for article in articles
    ]

    scores = score_headlines(
        headlines,
        batch_size=model_batch_size,
    )

    updated_count = 0
    failed_count = 0

    for article, score in zip(articles, scores):
        url = str(article.get("url") or "").strip()

        if not url:
            failed_count += 1
            print("Skipped article because its URL is missing.")
            continue

        try:
            update_article_sentiment(
                url=url,
                score=score,
            )

            updated_count += 1

        except Exception as exc:
            failed_count += 1

            print(
                f"Failed to update article {url}: "
                f"{type(exc).__name__}: {exc}"
            )

    return updated_count, failed_count


def run(
    query_batch_size: int = 200,
    model_batch_size: int = 128,
    max_articles: int | None = None,
) -> dict[str, int]:
    """
    Score pending news articles until no unscored articles remain.
    """
    total_processed = 0
    total_updated = 0
    total_failed = 0

    while True:
        if (
            max_articles is not None
            and total_processed >= max_articles
        ):
            break

        current_limit = query_batch_size

        if max_articles is not None:
            current_limit = min(
                query_batch_size,
                max_articles - total_processed,
            )

        articles = get_unscored_articles(
            limit=current_limit,
        )

        if not articles:
            print("No unscored articles found.")
            break

        updated_count, failed_count = score_article_batch(
            articles=articles,
            model_batch_size=model_batch_size,
        )

        total_processed += len(articles)
        total_updated += updated_count
        total_failed += failed_count

        print(
            f"Batch complete: "
            f"{updated_count} updated, "
            f"{failed_count} failed."
        )

        # Avoid repeatedly querying the same failing records forever.
        if updated_count == 0:
            print(
                "No articles were updated in this batch. "
                "Stopping to avoid an infinite loop."
            )
            break

    result = {
        "processed": total_processed,
        "updated": total_updated,
        "failed": total_failed,
    }

    print(f"Live sentiment scoring completed: {result}")

    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Score unscored live-news articles stored in Supabase."
        )
    )

    parser.add_argument(
        "--query-batch-size",
        type=int,
        default=200,
        help="Number of Supabase rows fetched per query.",
    )

    parser.add_argument(
        "--model-batch-size",
        type=int,
        default=128,
        help="Number of headlines processed by FinBERT per batch.",
    )

    parser.add_argument(
        "--max-articles",
        type=int,
        default=None,
        help="Optional maximum number of articles to process.",
    )

    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    run(
        query_batch_size=args.query_batch_size,
        model_batch_size=args.model_batch_size,
        max_articles=args.max_articles,
    )