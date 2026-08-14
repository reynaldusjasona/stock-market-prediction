from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit


TRAIN_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "NVDA", "META", "AMD", "ORCL", "CRM",
    "AMZN", "TSLA", "WMT", "COST", "MCD", "NKE", "SBUX",
    "JPM", "BAC", "GS", "V", "MA",
    "JNJ", "PFE", "UNH", "MRK", "ABBV",
    "XOM", "CVX", "COP",
    "BA", "CAT", "GE",
    "DIS", "NFLX", "KO", "PEP",
]

# High and Low are excluded from model training.
EXCLUDED_COLUMNS = {
    "Date",
    "Ticker",
    "Label",
    "dynamic_target",
    "upper_barrier_price",
    "lower_barrier_price",
    "Upper_Touched",
    "Lower_Touched",
    "Barrier_Type",
    "Barrier_Day",
    "High",
    "Low",
}

FUTURE_COLUMN_PREFIXES = (
    "future_high_",
    "future_low_",
)


def get_model_feature_columns(
    df: pd.DataFrame,
    feature_whitelist: list[str] | tuple[str, ...] | None = None,
) -> list[str]:
    """Return leakage-safe model feature columns.

    When a whitelist is provided (recommended), its order becomes the single
    source of truth shared by training and evaluation. This prevents newly
    added label-generation columns from silently entering the model.
    """
    if feature_whitelist is not None:
        missing = [column for column in feature_whitelist if column not in df.columns]
        if missing:
            raise ValueError(
                "Expected model features are missing from the labeled dataset: "
                f"{missing}"
            )

        forbidden = [
            column
            for column in feature_whitelist
            if column in EXCLUDED_COLUMNS
            or column.startswith(FUTURE_COLUMN_PREFIXES)
        ]
        if forbidden:
            raise ValueError(
                "Feature whitelist contains leakage/metadata columns: "
                f"{forbidden}"
            )

        return list(feature_whitelist)

    return [
        column
        for column in df.columns
        if column not in EXCLUDED_COLUMNS
        and not column.startswith(FUTURE_COLUMN_PREFIXES)
    ]


def get_artifact_names(horizon_days: int) -> dict[str, str]:
    """Return horizon-specific artifact filenames."""
    if horizon_days < 1:
        raise ValueError("horizon_days must be at least 1.")

    horizon_suffix = "" if horizon_days == 1 else f"_{horizon_days}day"

    return {
        "model_prefix": f"xgboost_model{horizon_suffix}",
        "latest_model": f"xgboost_model{horizon_suffix}_latest.joblib",
        "label_encoder": f"label_encoder{horizon_suffix}.pkl",
        "optuna_trials": f"optuna_trials{horizon_suffix}.csv",
        "optuna_best_params": f"optuna_best_params{horizon_suffix}.json",
        "study_name": f"xgboost_binary_stock_direction{horizon_suffix}",
    }


def get_artifact_paths(
    model_dir: str | Path,
    horizon_days: int,
) -> dict[str, Path]:
    """Return full paths for artifacts used by training/evaluation."""
    model_path = Path(model_dir)
    names = get_artifact_names(horizon_days)

    return {
        "latest_model": model_path / names["latest_model"],
        "label_encoder": model_path / names["label_encoder"],
        "optuna_trials": model_path / names["optuna_trials"],
        "optuna_best_params": model_path / names["optuna_best_params"],
    }


def split_data(
    X: pd.DataFrame,
    y: pd.Series,
    dates: pd.Series | None = None,
    purge_days: int = 0,
) -> tuple[
    pd.DataFrame,
    pd.DataFrame,
    pd.DataFrame,
    pd.Series,
    pd.Series,
    pd.Series,
]:
    """
    Perform a chronological 70/15/15 split.
    """
    if len(X) != len(y):
        raise ValueError("X and y must contain the same number of rows.")
    if purge_days < 0:
        raise ValueError("purge_days must be non-negative.")

    if dates is None:
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

    if len(dates) != len(X):
        raise ValueError("dates must contain the same number of rows as X and y.")

    date_series = pd.Series(pd.to_datetime(dates, errors="coerce")).reset_index(drop=True)
    if date_series.isna().any():
        raise ValueError("dates contains invalid or missing datetime values.")

    unique_dates = pd.Index(date_series.drop_duplicates().sort_values())
    n_dates = len(unique_dates)
    train_end = int(n_dates * 0.70)
    validation_end = int(n_dates * 0.85)

    train_dates = unique_dates[:train_end]
    validation_dates = unique_dates[train_end:validation_end]
    test_dates = unique_dates[validation_end:]

    if purge_days:
        if len(train_dates) <= purge_days or len(validation_dates) <= purge_days:
            raise ValueError(
                "Not enough dates to apply the requested purge_days to the "
                "train/validation partitions."
            )
        train_dates = train_dates[:-purge_days]
        validation_dates = validation_dates[:-purge_days]

    train_positions = np.flatnonzero(date_series.isin(train_dates).to_numpy())
    validation_positions = np.flatnonzero(
        date_series.isin(validation_dates).to_numpy()
    )
    test_positions = np.flatnonzero(date_series.isin(test_dates).to_numpy())

    return (
        X.iloc[train_positions].copy(),
        X.iloc[validation_positions].copy(),
        X.iloc[test_positions].copy(),
        y.iloc[train_positions].copy(),
        y.iloc[validation_positions].copy(),
        y.iloc[test_positions].copy(),
    )


def iter_purged_time_series_splits(
    dates: pd.Series,
    n_splits: int = 3,
    purge_days: int = 0,
):
    """
    Yield row-position train/validation folds split on unique dates.
    """
    if n_splits < 2:
        raise ValueError("n_splits must be at least 2.")
    if purge_days < 0:
        raise ValueError("purge_days must be non-negative.")

    date_series = pd.Series(pd.to_datetime(dates, errors="coerce")).reset_index(drop=True)
    if date_series.isna().any():
        raise ValueError("dates contains invalid or missing datetime values.")

    unique_dates = pd.Index(date_series.drop_duplicates().sort_values())
    splitter = TimeSeriesSplit(n_splits=n_splits)

    for train_date_positions, validation_date_positions in splitter.split(unique_dates):
        train_dates = unique_dates[train_date_positions]
        validation_dates = unique_dates[validation_date_positions]

        if purge_days:
            if len(train_dates) <= purge_days:
                continue
            train_dates = train_dates[:-purge_days]

        train_rows = np.flatnonzero(date_series.isin(train_dates).to_numpy())
        validation_rows = np.flatnonzero(
            date_series.isin(validation_dates).to_numpy()
        )

        if len(train_rows) and len(validation_rows):
            yield train_rows, validation_rows
