"""
Downloads historical financial news articles from the GDELT database,
filters company-relevant articles, and stores them locally for
offline sentiment analysis.

"""

from __future__ import annotations

import os
from collections import Counter
from datetime import date
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from google.cloud import bigquery

from ml.training.build_sentiment_features import assign_to_trading_session

load_dotenv()

_RAW_CACHE_PATH = Path("ml/historical_sentiment_data/gdelt__news_headlines.csv")
_CSV_BATCH_SIZE = 10_000

_START_DATE = "2020-01-01"
_END_DATE = "2026-01-01"  # Exclusive; includes all of 2025.
_CHUNK_MONTHS = 3
_UPSERT_BATCH_SIZE = 500

COMPANY_ALIASES: dict[str, list[str]] = {
    "AAPL": ["apple", "apple inc", "apple inc."],
    "MSFT": ["microsoft", "microsoft corp", "microsoft corporation"],
    "GOOGL": ["google", "alphabet", "alphabet inc", "alphabet inc."],
    "NVDA": ["nvidia", "nvidia corp", "nvidia corporation"],
    "META": ["meta platforms", "meta platforms inc", "facebook", "facebook inc"],
    "AMD": ["advanced micro devices", "advanced micro devices inc"],
    "ORCL": ["oracle", "oracle corp", "oracle corporation"],
    "CRM": ["salesforce", "salesforce.com"],
    "AMZN": ["amazon", "amazon.com", "amazon.com inc"],
    "TSLA": ["tesla", "tesla inc", "tesla motors", "tesla inc."],
    "WMT": ["walmart", "wal-mart", "walmart inc"],
    "COST": ["costco", "costco wholesale", "costco wholesale corporation"],
    "MCD": ["mcdonald's", "mcdonalds", "mcdonald's corporation", "mcdonald"],
    "NKE": ["nike", "nike inc", "nike inc."],
    "SBUX": ["starbucks", "starbucks corporation"],
    "JPM": [
        "jpmorgan chase", "jp morgan chase", "jpmorgan", "chase bank",
        "j.p. morgan chase", "j.p. morgan",
    ],
    "BAC": [
        "bank of america", "bank of america corporation", "bofa",
        "bofa securities", "merrill lynch",
    ],
    "GS": ["goldman sachs", "goldman sachs group"],
    "V": ["visa inc", "visa corporation"],
    "MA": ["mastercard", "mastercard inc"],
    "JNJ": ["johnson & johnson", "johnson and johnson"],
    "PFE": ["pfizer", "pfizer inc"],
    "UNH": ["unitedhealth group", "unitedhealth"],
    "MRK": ["merck", "merck & co", "merck and co"],
    "ABBV": ["abbvie", "abbvie inc"],
    "XOM": ["exxon mobil", "exxonmobil", "exxon"],
    "CVX": ["chevron", "chevron corporation"],
    "COP": ["conocophillips", "conoco phillips"],
    "BA": ["boeing", "boeing company"],
    "CAT": ["caterpillar", "caterpillar inc"],
    "GE": ["general electric", "ge aerospace"],
    "DIS": ["walt disney", "the walt disney company", "disney"],
    "NFLX": ["netflix", "netflix inc"],
    "KO": ["coca-cola", "coca cola", "coca-cola company"],
    "PEP": ["pepsico", "pepsi co", "pepsi"],
}


def _date_chunks(start: str, end: str, months: int) -> list[tuple[str, str]]:
    """
    Split a large date range into smaller month-based intervals.

    Args:
        start: Start date in YYYY-MM-DD format.
        end: Exclusive end date in YYYY-MM-DD format.
        months: Number of months in each query interval.

    Returns:
        A list of (start_date, end_date) tuples.
    """
    if months <= 0:
        raise ValueError("months must be greater than 0")

    start_d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)

    if start_d >= end_d:
        raise ValueError("start must be earlier than end")

    chunks: list[tuple[str, str]] = []
    current = start_d

    while current < end_d:
        year = current.year + (current.month - 1 + months) // 12
        month = (current.month - 1 + months) % 12 + 1
        next_start = date(year, month, 1)
        chunk_end = min(next_start, end_d)
        chunks.append((current.isoformat(), chunk_end.isoformat()))
        current = chunk_end

    return chunks


def _sql_string(value: str) -> str:
    """
    Escape a Python string for use as a BigQuery string literal.

    Args:
        value: Plain text value.

    Returns:
        A single-quoted BigQuery string literal.
    """
    escaped = value.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


def _alias_cte() -> str:
    """
    Build SQL rows that map stock tickers to company aliases.

    Returns:
        A SQL fragment used inside the company_aliases CTE.
    """
    rows: list[str] = []

    for ticker, aliases in COMPANY_ALIASES.items():
        for alias in aliases:
            rows.append(
                "SELECT "
                f"{_sql_string(ticker)} AS ticker, "
                f"{_sql_string(alias.lower())} AS alias"
            )

    return "\nUNION ALL\n".join(rows)


_FINANCIAL_HEADLINE_PATTERN = (
    r"(earnings?|revenue|profit|loss|sales|guidance|forecast|"
    r"quarterly results|annual results|financial results|"
    r"stock|stocks|shares?|share price|investors?|analysts?|"
    r"upgrade|downgrade|price target|valuation|market value|"
    r"dividend|buyback|share repurchase|merger|acquisition|buyout|"
    r"investment|partnership|contract|deal|agreement|"
    r"production|factory|supplier|supply chain|launch|chip|"
    r"artificial intelligence|antitrust|lawsuit|regulation|"
    r"layoffs?|chief executive|ceo|cfo|ipo|debt|cash flow|"
    r"operating income|net income|gross margin|operating margin|"
    r"capital expenditure|free cash flow|balance sheet|"
    r"market share|restructuring|bankruptcy|credit rating|"

    # Banking and financial-sector keywords
    r"interest rates?|federal reserve|central bank|fed meeting|"
    r"loan|loans|lending|mortgage|mortgages|deposit|deposits|"
    r"credit|credit card|consumer credit|commercial banking|"
    r"investment banking|wealth management|asset management|"
    r"capital ratio|capital requirement|stress test|"
    r"net interest income|net interest margin|"
    r"loan loss|credit loss|provision for credit losses|"
    r"default rate|delinquency|bond yield|treasury yield|"
    r"rate cut|rate hike|monetary policy|liquidity)"
)

_FINANCIAL_THEME_PATTERN = (
    r"(ECON_|ECONOMY|BUSINESS|FINANCIAL|CORPORATE|"
    r"TAX_|TRADE_|BANKING|INVESTMENT|STOCKMARKET|"
    r"MERGER|ACQUISITION|BANKRUPTCY|DEBT|CREDIT|"
    r"MONETARY_POLICY|INTEREST_RATE|EMPLOYMENT|"
    r"REGULATION|ANTITRUST|MARKET)"
)

_EXCLUDED_HEADLINE_PATTERN = (
    r"\b("
    # Market research spam
    r"global .{0,50} market|market research|market study|"
    r"market analysis|market size|industry report|"
    r"competitive landscape|key players|"
    r"booming worldwide|press release|"

    # Entertainment and streaming content
    r"season [0-9]+|new season|episode|episodes|"
    r"trailer|teaser|movie|movies|film|films|"
    r"tv show|tv shows|television series|"
    r"cast|casting|character|characters|"
    r"spoiler|spoilers|recap|review|reviews|"
    r"what to watch|now streaming|coming to netflix|"
    r"coming to disney|new on netflix|new to netflix|"
    r"new on disney|disney plus shows|netflix series|"
    r"release date|premiere|box office preview|"
    r"best movies|best shows|watchlist|"

    # Common consumer/lifestyle noise
    r"recipe|recipes|shopping tips|gift guide|"
    r"how to use|how to buy|wallpaper|accessories|"
    r"horoscope|weather|obituary|"
    r"top [0-9]+ tips|best deals|coupon|coupons|"
    r"wine at costco|costco shopping|"

    # Local crime and isolated incidents
    r"arrested|arrest|police looking for|"
    r"theft|stolen|robbery|shoplifting|"
    r"shooting|murder|kidnapping|"
    r"facebook marketplace scam|"
    r"walmart fire|store fire|"
    r"suspect|suspects|troopers|"

    # Social-media references not about the company
    r"facebook post|facebook page|"
    r"posted on facebook|shared on facebook|"
    r"facebook group|instagram filter|"
    r"viral video|viral post"
    r")\b"
)

_EXCLUDED_THEME_PATTERN = (
    r"(ENTERTAINMENT|CELEBRITY|SPORT|SPORTS|"
    r"CRIME|CRIME_|"
    r"OBITUARY|"
    r"TOURISM|TRAVEL|"
    r"FASHION|"
    r"FOOD|FOOD_|"
    r"RELIGION|"
    r"HEALTH_PANDEMIC|"
    r"MEDIA_MSM)"
)

_APPROVED_DOMAIN_PATTERN = (
    r"(reuters\.com|"
    r"bloomberg\.com|"
    r"cnbc\.com|"
    r"marketwatch\.com|"
    r"wsj\.com|"
    r"barrons\.com|"
    r"finance\.yahoo\.com|"
    r"businessinsider\.com|"
    r"forbes\.com|"
    r"foxbusiness\.com|"
    r"investing\.com|"
    r"seekingalpha\.com|"
    r"benzinga\.com|"
    r"fool\.com|"
    r"morningstar\.com|"
    r"thestreet\.com|"
    r"nasdaq\.com|"
    r"marketscreener\.com|"
    r"investors\.com|"
    r"fortune\.com|"
    r"ft\.com|"
    r"economist\.com|"
    r"businesswire\.com|"
    r"globenewswire\.com|"
    r"prnewswire\.com|"
    r"apnews\.com|"
    r"bbc\.com|"
    r"theguardian\.com|"
    r"nytimes\.com|"
    r"washingtonpost\.com|"
    r"techcrunch\.com|"
    r"theverge\.com|"
    r"arstechnica\.com|"
    r"law360\.com)"
)


_GDELT_QUERY = f"""
WITH company_aliases AS (
    {_alias_cte()}
),

matched_articles AS (
    SELECT DISTINCT
        aliases.ticker,
        aliases.alias,
        gkg.DocumentIdentifier AS url,
        IFNULL(gkg.V2Themes, '') AS themes
    FROM `gdelt-bq.gdeltv2.gkg_partitioned` AS gkg
    CROSS JOIN UNNEST(
        SPLIT(IFNULL(gkg.V2Organizations, ''), ';')
    ) AS organization_token
    JOIN company_aliases AS aliases
      ON LOWER(
            TRIM(
                REGEXP_REPLACE(
                    organization_token,
                    ',[0-9]+$',
                    ''
                )
            )
         ) = aliases.alias
    WHERE DATE(_PARTITIONTIME) >= @start_date
      AND DATE(_PARTITIONTIME) < @end_date
      AND gkg.DocumentIdentifier IS NOT NULL
),

articles AS (
    SELECT DISTINCT
        date AS published_at,
        url,
        title AS headline,
        lang
    FROM `gdelt-bq.gdeltv2.gal`
    WHERE DATE(date) >= @start_date
      AND DATE(date) < @end_date
      AND LOWER(lang) = 'en'
      AND url IS NOT NULL
      AND title IS NOT NULL
),

joined_articles AS (
    SELECT
        matched.ticker,
        matched.alias,
        matched.themes,
        articles.published_at,
        articles.url,
        articles.headline,
        articles.lang
    FROM matched_articles AS matched
    JOIN articles
      ON matched.url = articles.url
),

company_relevant_articles AS (
    SELECT *
    FROM joined_articles
    WHERE STRPOS(
        CONCAT(
            ' ',
            REGEXP_REPLACE(
                LOWER(headline),
                '[^a-z0-9]+',
                ' '
            ),
            ' '
        ),
        CONCAT(
            ' ',
            REGEXP_REPLACE(
                LOWER(alias),
                '[^a-z0-9]+',
                ' '
            ),
            ' '
        )
    ) > 0
),

financial_articles AS (
    SELECT *
    FROM company_relevant_articles
    WHERE
        -- Only approved financial/business/technology sources
        REGEXP_CONTAINS(
            LOWER(url),
            {_sql_string(_APPROVED_DOMAIN_PATTERN)}
        )

        -- Headline must contain a financial term
        AND REGEXP_CONTAINS(
            LOWER(headline),
            {_sql_string(_FINANCIAL_HEADLINE_PATTERN)}
        )

        -- GDELT must indicate financial/business context
        OR REGEXP_CONTAINS(
            UPPER(themes),
            {_sql_string(_FINANCIAL_THEME_PATTERN)}
        )

        -- Remove entertainment, consumer and crime noise
        AND NOT REGEXP_CONTAINS(
            LOWER(headline),
            {_sql_string(_EXCLUDED_HEADLINE_PATTERN)}
        )

        -- Reject excluded themes unless the headline is strongly financial
        AND (
            NOT REGEXP_CONTAINS(
                UPPER(themes),
                {_sql_string(_EXCLUDED_THEME_PATTERN)}
            )
            OR REGEXP_CONTAINS(
                LOWER(headline),
                r'\\b(earnings?|revenue|profit|sales|guidance|stock|shares|'
                r'dividend|merger|acquisition|lawsuit|regulation|'
                r'financial results|quarterly results|annual results)\\b'
            )
        )

        AND LOWER(url) NOT LIKE '%openpr.com%'
        AND LOWER(url) NOT LIKE '%empowerednews.net%'
        AND LOWER(url) NOT LIKE '%ssuchronicle.com%'
        AND LOWER(url) NOT LIKE '%marketresearch%'
)

SELECT
    ticker,
    published_at,
    url,
    headline,
    lang
FROM financial_articles
QUALIFY ROW_NUMBER() OVER (
    PARTITION BY
        ticker,
        REGEXP_REPLACE(
            LOWER(TRIM(headline)),
            '[^a-z0-9]+',
            ' '
        )
    ORDER BY published_at
) = 1
"""


def fetch_gdelt_chunk(
    client: bigquery.Client,
    start: str,
    end: str,
) -> list[dict]:
    """
    Query GDELT for company-related financial articles in one interval.

    Args:
        client: Authenticated Google BigQuery client.
        start: Start date in YYYY-MM-DD format.
        end: Exclusive end date in YYYY-MM-DD format.

    Returns:
        A list of dictionaries containing ticker, publication time,
        URL, headline, and language.
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter(
                "start_date",
                "DATE",
                date.fromisoformat(start),
            ),
            bigquery.ScalarQueryParameter(
                "end_date",
                "DATE",
                date.fromisoformat(end),
            ),
        ]
    )

    query_job = client.query(
        _GDELT_QUERY,
        job_config=job_config,
        location="US",
    )

    return [dict(row.items()) for row in query_job.result()]


def _prepare_raw_rows(rows: list[dict]) -> list[dict]:
    """
    Validate GDELT articles and assign each article to a trading session.

    Returns:
        Clean article records to be saved to CSV.
    """
    prepared: list[dict] = []

    for row in rows:
        ticker = str(row.get("ticker", "")).upper().strip()
        headline = str(row.get("headline", "")).strip()
        url = str(row.get("url", "")).strip()
        published_at = row.get("published_at")

        if not ticker or not headline or published_at is None:
            continue

        timestamp = pd.Timestamp(published_at)

        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize("UTC")
        else:
            timestamp = timestamp.tz_convert("UTC")

        session_date = (
            assign_to_trading_session(timestamp)
            .date()
            .isoformat()
        )

        prepared.append({
            "ticker": ticker,
            "published_at": timestamp.isoformat(),
            "session_date": session_date,
            "headline": headline,
            "url": url,
            "data_provider": "gdelt",
        })

    return prepared


def _append_to_cache(
    rows: list[dict],
    cache_path: Path = _RAW_CACHE_PATH,
) -> int:

    if not rows:
        return 0

    cache_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    df = pd.DataFrame(rows)

    file_exists = cache_path.exists()

    df.to_csv(
        cache_path,
        mode="a",
        header=not file_exists,
        index=False,
        encoding="utf-8",
    )

    return len(df)


def _deduplicate_cache(
    cache_path: Path = _RAW_CACHE_PATH,
) -> int:
    if not cache_path.exists():
        return 0

    dataframe = pd.read_csv(cache_path)
    before = len(dataframe)

    dataframe = dataframe.drop_duplicates(
        subset=["ticker", "url"],
        keep="first",
    )

    dataframe = dataframe.sort_values(
        ["published_at", "ticker"],
    )

    dataframe.to_csv(
        cache_path,
        index=False,
        encoding="utf-8",
    )

    return before - len(dataframe)


def run_backfill() -> None:
    """
    Collect historical company news from GDELT and save raw headlines
    to a local CSV cache.

    This function does not load FinBERT or PyTorch. Sentiment scoring
    will be performed later by a separate script.
    """
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or None
    client = bigquery.Client(project=project_id)

    total_queried = 0
    total_cached = 0
    ticker_counts: Counter[str] = Counter()

    _RAW_CACHE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("Starting GDELT news collection")
    print(f"Date range: {_START_DATE} -> {_END_DATE}")
    print(f"Cache file: {_RAW_CACHE_PATH.resolve()}")

    for start, end in _date_chunks(
        _START_DATE,
        _END_DATE,
        _CHUNK_MONTHS,
    ):
        print(f"\nQuerying GDELT: {start} -> {end}")

        try:
            raw_rows = fetch_gdelt_chunk(
                client=client,
                start=start,
                end=end,
            )

            prepared_rows = _prepare_raw_rows(raw_rows)

            cached_count = _append_to_cache(
                prepared_rows,
            )

            total_queried += len(raw_rows)
            total_cached += cached_count

            ticker_counts.update(
                row["ticker"]
                for row in prepared_rows
            )

            print(
                f"{start} -> {end}: "
                f"{len(raw_rows)} queried, "
                f"{cached_count} cached"
            )

        except KeyboardInterrupt:
            print(
                "\nCollection stopped by user. "
                "Previously completed chunks remain saved."
            )
            break

        except Exception as exc:
            print(
                f"{start} -> {end}: FAILED "
                f"({type(exc).__name__}: {exc})"
            )

    duplicates_removed = _deduplicate_cache()

    print("\nGDELT collection finished")
    print(f"Total queried       : {total_queried}")
    print(f"Total cached        : {total_cached}")
    print(f"Duplicates removed  : {duplicates_removed}")
    print(f"Final cache path: {_RAW_CACHE_PATH.resolve()}")
    print(
        "Ticker counts       : "
        f"{dict(sorted(ticker_counts.items()))}"
    )


if __name__ == "__main__":
    run_backfill()
