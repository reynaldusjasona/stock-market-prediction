import pandas as pd

TRAIN_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "NVDA", "META", "AMD", "ORCL", "CRM",
    "AMZN", "TSLA", "WMT", "COST", "MCD", "NKE", "SBUX",
    "JPM", "BAC", "GS", "V", "MA",
    "JNJ", "PFE", "UNH", "MRK", "ABBV",
    "XOM", "CVX", "COP",
    "BA", "CAT", "GE",
    "DIS", "NFLX", "KO", "PEP",
]


def split_data(
    X: pd.DataFrame,
    y: pd.Series,
) -> tuple[
    pd.DataFrame, pd.DataFrame, pd.DataFrame,
    pd.Series, pd.Series, pd.Series,
]:
    """Perform a chronological 70/15/15 split."""
    n_samples = len(X)
    train_end = int(n_samples * 0.70)
    validation_end = int(n_samples * 0.85)

    return (
        X.iloc[:train_end].copy(),
        X.iloc[train_end:validation_end].copy(),
        X.iloc[validation_end:].copy(),
        y.iloc[:train_end].copy(),
        y.iloc[train_end:validation_end].copy(),
        y.iloc[validation_end:].copy(),
    )
