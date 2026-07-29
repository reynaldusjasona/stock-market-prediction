"""
Scores historical financial news using FinBERT and aggregates daily
sentiment features for machine learning model training.


Input:
    ml/historical_sentiment_data/gdelt_news_headlines_reduced.csv

Outputs:
    ml/historical_sentiment_data/gdelt_scored_headlines.csv
    ml/historical_sentiment_data/historical_daily_sentiment.csv
"""

from __future__ import annotations

import time
from pathlib import Path

import pandas as pd

from ml.sentiment_data.build_finbert_pipeline import score_headlines


DATA_DIR = Path(__file__).resolve().parent / "historical_sentiment_data"

INPUT_FILE = DATA_DIR / "gdelt_news_headlines_reduced.csv"
SCORED_FILE = DATA_DIR / "gdelt_scored_headlines.csv"
DAILY_FILE = DATA_DIR / "historical_daily_sentiment.csv"

CHUNK_SIZE = 5_000
MODEL_BATCH_SIZE = 128


def load_data() -> pd.DataFrame:
    """Load and clean the reduced GDELT headlines."""

    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {INPUT_FILE}"
        )

    df = pd.read_csv(INPUT_FILE)

    required = {
        "ticker",
        "session_date",
        "headline",
    }

    missing = required - set(df.columns)

    if missing:
        raise ValueError(
            f"Missing columns: {sorted(missing)}"
        )

    df["ticker"] = (
        df["ticker"]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    df["headline"] = (
        df["headline"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    df["session_date"] = pd.to_datetime(
        df["session_date"],
        errors="coerce",
    )

    df = df.dropna(
        subset=[
            "ticker",
            "session_date",
        ]
    )

    df = df[
        df["headline"] != ""
    ].copy()

    df["_row_id"] = range(len(df))

    return df


def get_completed_ids() -> set[int]:
    """Return row IDs that have already been scored."""

    if not SCORED_FILE.exists():
        return set()

    completed = pd.read_csv(
        SCORED_FILE,
        usecols=["_row_id"],
    )

    return set(
        pd.to_numeric(
            completed["_row_id"],
            errors="coerce",
        )
        .dropna()
        .astype(int)
        .tolist()
    )


def score_data(df: pd.DataFrame) -> None:
    """Score all remaining headlines."""

    completed_ids = get_completed_ids()

    pending = df[
        ~df["_row_id"].isin(completed_ids)
    ].copy()

    already_scored = len(df) - len(pending)

    print(f"Total rows:     {len(df):,}")
    print(f"Already scored: {already_scored:,}")
    print(f"Remaining:      {len(pending):,}")

    if pending.empty:
        return

    start_time = time.time()
    scored_this_run = 0

    write_header = not SCORED_FILE.exists()

    for start in range(
        0,
        len(pending),
        CHUNK_SIZE,
    ):
        chunk = pending.iloc[
            start: start + CHUNK_SIZE
        ].copy()

        scores = score_headlines(
            chunk["headline"].tolist(),
            batch_size=MODEL_BATCH_SIZE,
        )

        chunk["sentiment_score"] = scores

        chunk["sentiment_label"] = (
            chunk["sentiment_score"]
            .apply(
                lambda score: (
                    "Positive"
                    if score > 0.05
                    else "Negative"
                    if score < -0.05
                    else "Neutral"
                )
            )
        )

        chunk.to_csv(
            SCORED_FILE,
            mode="a",
            header=write_header,
            index=False,
        )

        write_header = False

        scored_this_run += len(chunk)

        elapsed = time.time() - start_time

        speed = (
            scored_this_run / elapsed
            if elapsed > 0
            else 0
        )

        remaining = (
            len(pending)
            - scored_this_run
        )

        eta_hours = (
            remaining / speed / 3600
            if speed > 0
            else 0
        )

        total_done = (
            already_scored
            + scored_this_run
        )

        print(
            f"Scored {total_done:,}/{len(df):,} "
            f"| Speed: {speed:.1f} rows/sec "
            f"| ETA: {eta_hours:.2f} hours",
            flush=True,
        )


def build_daily_sentiment() -> None:
    """Aggregate headline sentiment into daily ticker sentiment."""

    print("Building daily sentiment...")

    scored = pd.read_csv(SCORED_FILE)

    scored["session_date"] = pd.to_datetime(
        scored["session_date"],
        errors="coerce",
    )

    scored["sentiment_score"] = pd.to_numeric(
        scored["sentiment_score"],
        errors="coerce",
    )

    scored = scored.dropna(
        subset=[
            "ticker",
            "session_date",
            "sentiment_score",
        ]
    )

    daily = (
        scored.groupby(
            [
                "ticker",
                "session_date",
            ],
            as_index=False,
        )
        .agg(
            sentiment_mean=(
                "sentiment_score",
                "mean",
            ),
            sentiment_std=(
                "sentiment_score",
                "std",
            ),
            news_count=(
                "sentiment_score",
                "count",
            ),
        )
        .sort_values(
            [
                "ticker",
                "session_date",
            ]
        )
        .reset_index(drop=True)
    )

    daily["sentiment_std"] = (
        daily["sentiment_std"]
        .fillna(0)
    )

    daily["news_count"] = (
        daily["news_count"]
        .astype(int)
    )

    daily["session_date"] = (
        daily["session_date"]
        .dt.strftime("%Y-%m-%d")
    )

    daily.to_csv(
        DAILY_FILE,
        index=False,
    )

    print(
        f"Saved {len(daily):,} daily records."
    )


def main() -> None:
    df = load_data()

    score_data(df)

    completed_ids = get_completed_ids()

    if len(completed_ids) < len(df):
        print(
            "Scoring is incomplete. "
            "Run the script again to continue."
        )
        return

    build_daily_sentiment()

    print("Done.")


if __name__ == "__main__":
    main()
