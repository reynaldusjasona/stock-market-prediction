import os
import sys

from dotenv import load_dotenv

load_dotenv()

if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_KEY"):
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")
    sys.exit(1)

from app.core.database import supabase  # noqa: E402


_STOCK_ROWS = [
    ("AAPL", "Apple Inc.", "Technology", "NASDAQ"),
    ("MSFT", "Microsoft Corporation", "Technology", "NASDAQ"),
    ("GOOGL", "Alphabet Inc.", "Technology", "NASDAQ"),
    ("AMZN", "Amazon.com Inc.", "Consumer Cyclical", "NASDAQ"),
    ("META", "Meta Platforms Inc.", "Technology", "NASDAQ"),
    ("TSLA", "Tesla Inc.", "Consumer Cyclical", "NASDAQ"),
    ("NVDA", "NVIDIA Corporation", "Technology", "NASDAQ"),
    ("JPM", "JPMorgan Chase & Co.", "Financial Services", "NYSE"),
    ("V", "Visa Inc.", "Financial Services", "NYSE"),
    ("JNJ", "Johnson & Johnson", "Healthcare", "NYSE"),
    ("WMT", "Walmart Inc.", "Consumer Defensive", "NYSE"),
    ("PG", "Procter & Gamble Co.", "Consumer Defensive", "NYSE"),
    ("MA", "Mastercard Inc.", "Financial Services", "NYSE"),
    ("UNH", "UnitedHealth Group Inc.", "Healthcare", "NYSE"),
    ("HD", "The Home Depot Inc.", "Consumer Cyclical", "NYSE"),
    ("DIS", "The Walt Disney Company", "Communication Services", "NYSE"),
    ("BAC", "Bank of America Corp.", "Financial Services", "NYSE"),
    ("XOM", "Exxon Mobil Corporation", "Energy", "NYSE"),
    ("PFE", "Pfizer Inc.", "Healthcare", "NYSE"),
    ("KO", "The Coca-Cola Company", "Consumer Defensive", "NYSE"),
    ("PEP", "PepsiCo Inc.", "Consumer Defensive", "NASDAQ"),
    ("CSCO", "Cisco Systems Inc.", "Technology", "NASDAQ"),
    ("NFLX", "Netflix Inc.", "Communication Services", "NASDAQ"),
    ("ADBE", "Adobe Inc.", "Technology", "NASDAQ"),
    ("CRM", "Salesforce Inc.", "Technology", "NYSE"),
    ("AMD", "Advanced Micro Devices Inc.", "Technology", "NASDAQ"),
    ("INTC", "Intel Corporation", "Technology", "NASDAQ"),
    ("NKE", "NIKE Inc.", "Consumer Cyclical", "NYSE"),
    ("COST", "Costco Wholesale Corporation", "Consumer Defensive", "NASDAQ"),
    ("T", "AT&T Inc.", "Communication Services", "NYSE"),
    ("VZ", "Verizon Communications Inc.", "Communication Services", "NYSE"),
    ("MRK", "Merck & Co. Inc.", "Healthcare", "NYSE"),
    ("ABT", "Abbott Laboratories", "Healthcare", "NYSE"),
    ("LLY", "Eli Lilly and Company", "Healthcare", "NYSE"),
    ("ORCL", "Oracle Corporation", "Technology", "NYSE"),
    ("QCOM", "Qualcomm Inc.", "Technology", "NASDAQ"),
    ("SBUX", "Starbucks Corporation", "Consumer Cyclical", "NASDAQ"),
    ("GS", "Goldman Sachs Group Inc.", "Financial Services", "NYSE"),
    ("MS", "Morgan Stanley", "Financial Services", "NYSE"),
    ("BLK", "BlackRock Inc.", "Financial Services", "NYSE"),
    ("PYPL", "PayPal Holdings Inc.", "Financial Services", "NASDAQ"),
    ("SQ", "Block Inc.", "Financial Services", "NYSE"),
    ("UBER", "Uber Technologies Inc.", "Technology", "NYSE"),
    ("ABNB", "Airbnb Inc.", "Consumer Cyclical", "NASDAQ"),
    ("COIN", "Coinbase Global Inc.", "Financial Services", "NASDAQ"),
    ("PLTR", "Palantir Technologies Inc.", "Technology", "NASDAQ"),
    ("SOFI", "SoFi Technologies Inc.", "Financial Services", "NASDAQ"),
    ("RIVN", "Rivian Automotive Inc.", "Consumer Cyclical", "NASDAQ"),
    ("SNAP", "Snap Inc.", "Communication Services", "NYSE"),
    ("GME", "GameStop Corp.", "Consumer Cyclical", "NYSE"),
]

STOCKS = [
    {"ticker": ticker, "company_name": name, "sector": sector, "exchange": exchange}
    for ticker, name, sector, exchange in _STOCK_ROWS
]


def seedStocks() -> None:
    insertedCount = 0
    failures = []
    for stock in STOCKS:
        try:
            supabase.table("stocks").upsert(
                stock, on_conflict="ticker"
            ).execute()
            insertedCount += 1
        except Exception as exc:
            failures.append((stock["ticker"], str(exc)))

    print(f"Seeded {insertedCount}/{len(STOCKS)} stocks into Supabase.")
    if failures:
        print(f"{len(failures)} failure(s):")
        for ticker, err in failures:
            print(f"  {ticker}: {err}")
    else:
        print("No failures.")

    verifyResult = (
        supabase.table("stocks")
        .select("ticker, company_name")
        .limit(5)
        .execute()
    )
    print("\nSample rows from stocks table:")
    for row in verifyResult.data or []:
        print(f"  {row['ticker']}: {row['company_name']}")


if __name__ == "__main__":
    seedStocks()
