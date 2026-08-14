from __future__ import annotations

import pandas as pd


LABELS = {"Buy", "Sell"}


def calculate_dynamic_target(
    df: pd.DataFrame,
    close_col: str = "Close",
    horizon_days: int = 1,
    volatility_window: int = 20,
) -> pd.Series:
    """
    Calculate dynamic return target based on historical rolling volatility.

    Args:
        df (pd.DataFrame): DataFrame containing stock price data with a 'Close'
            column.
        close_col (str): Name of the column containing closing prices. Default
            is 'Close'.
        horizon_days (int): Prediction horizon used to scale daily volatility.
            Default is 1.
        volatility_window (int): Window size for calculating rolling
            volatility. Default is 20.

    Returns:
        pd.Series: A Series containing the dynamic return target for each row
        in the DataFrame.
    """
    if close_col not in df.columns:
        raise ValueError(f"Column '{close_col}' not found in DataFrame.")
    if volatility_window < 2:
        raise ValueError("volatility_window must be at least 2.")
    if horizon_days < 1:
        raise ValueError("horizon_days must be at least 1.")

    close = pd.to_numeric(df[close_col], errors="coerce")

    dynamic_target = (
        close.pct_change()
        .rolling(volatility_window, min_periods=volatility_window)
        .std()
        .shift(1)
    )

    if horizon_days > 1:
        dynamic_target = dynamic_target * (horizon_days ** 0.5)

    return dynamic_target


def apply_triple_barrier_one_day(
    df: pd.DataFrame,
    close_col: str = "Close",
    profit_taking_multiplier: float = 1.5,
    stop_loss_multiplier: float = 1.5,
    volatility_window: int = 20,
    min_return: float = 0.005,
    drop_ambiguous: bool = True,
    drop_unlabeled: bool = True,
    binary_only: bool = True,
    horizon_days: int = 1,
) -> pd.DataFrame:
    """
    Apply the triple barrier method to label each row in the DataFrame as
    'Buy' or 'Sell'.

    For each day:
    - entry price = today's close price
    - upper barrier = entry price *
      (1 + profit_taking_multiplier * dynamic_target)
    - lower barrier = entry price *
      (1 - stop_loss_multiplier * dynamic_target)
    - examine future high and low prices within the selected horizon to
      determine which barrier was breached first.

    - Buy: A future high reaches the upper barrier first.
    - Sell: A future low reaches the lower barrier first.
    - Hold: Neither barrier is reached within the horizon (removed when
      binary_only is enabled).
    - Ambiguous: Both barriers are reached on the same day. Daily OHLC data
      cannot determine which barrier was touched first.

    Returns:
        pd.DataFrame: A DataFrame with triple-barrier columns plus a 'Label'
        column containing Buy and Sell labels when binary_only is enabled.
    """
    required_columns = {"Date", "High", "Low", close_col}
    missing_columns = required_columns.difference(df.columns)
    if missing_columns:
        raise ValueError(f"Missing required columns: {sorted(missing_columns)}")
    if horizon_days not in {1, 3, 5}:
        raise ValueError("horizon_days must be one of 1, 3, or 5.")
    if profit_taking_multiplier <= 0 or stop_loss_multiplier <= 0:
        raise ValueError("Barrier multipliers must be greater than 0.")
    if min_return < 0:
        raise ValueError("min_return must be non-negative.")

    result = df.copy()
    result["Date"] = pd.to_datetime(result["Date"], errors="coerce")
    result = result.sort_values("Date").reset_index(drop=True)
    for column in ["High", "Low", close_col]:
        result[column] = pd.to_numeric(result[column], errors="coerce")

    result["dynamic_target"] = calculate_dynamic_target(
        result,
        close_col=close_col,
        horizon_days=horizon_days,
        volatility_window=volatility_window,
    )
    result["upper_barrier_price"] = result[close_col] * (
        1 + profit_taking_multiplier * result["dynamic_target"]
    )
    result["lower_barrier_price"] = result[close_col] * (
        1 - stop_loss_multiplier * result["dynamic_target"]
    )

    upper_day = pd.Series(pd.NA, index=result.index, dtype="Int64")
    lower_day = pd.Series(pd.NA, index=result.index, dtype="Int64")
    future_available = pd.Series(True, index=result.index)
    for day in range(1, horizon_days + 1):
        future_high = result["High"].shift(-day)
        future_low = result["Low"].shift(-day)
        future_available &= future_high.notna() & future_low.notna()
        upper_hit = future_high >= result["upper_barrier_price"]
        lower_hit = future_low <= result["lower_barrier_price"]
        upper_day = upper_day.mask(upper_day.isna() & upper_hit, day)
        lower_day = lower_day.mask(lower_day.isna() & lower_hit, day)

    result["Upper_Touch_Day"] = upper_day
    result["Lower_Touch_Day"] = lower_day
    result["Upper_Touched"] = upper_day.notna()
    result["Lower_Touched"] = lower_day.notna()

    valid = (
        result["dynamic_target"].notna()
        & (result["dynamic_target"] >= min_return)
        & future_available
    )
    upper_first = upper_day.notna() & (
        lower_day.isna() | (upper_day < lower_day)
    )
    lower_first = lower_day.notna() & (
        upper_day.isna() | (lower_day < upper_day)
    )
    ambiguous = valid & upper_day.notna() & lower_day.notna() & (
        upper_day == lower_day
    )
    buy = valid & upper_first
    sell = valid & lower_first
    hold = valid & ~buy & ~sell & ~ambiguous

    result["Label"] = pd.NA
    result["Barrier_Type"] = pd.NA
    result["Barrier_Day"] = pd.NA
    result.loc[buy, ["Label", "Barrier_Type"]] = ["Buy", "upper"]
    result.loc[sell, ["Label", "Barrier_Type"]] = ["Sell", "lower"]
    result.loc[hold, ["Label", "Barrier_Type"]] = ["Hold", "vertical"]
    result.loc[ambiguous, "Barrier_Type"] = "ambiguous"
    result.loc[buy, "Barrier_Day"] = upper_day[buy]
    result.loc[sell, "Barrier_Day"] = lower_day[sell]
    result.loc[hold, "Barrier_Day"] = horizon_days
    result.loc[ambiguous, "Barrier_Day"] = upper_day[ambiguous]

    print(f"Valid {horizon_days}-day labeling events: {int(valid.sum())}")
    print(f"Ambiguous events: {int(ambiguous.sum())}")
    if drop_ambiguous:
        result = result.loc[~ambiguous].copy()
    if binary_only:
        result = result.loc[result["Label"].isin(LABELS)].copy()
    elif drop_unlabeled:
        result = result.loc[
            result["Label"].isin({"Buy", "Hold", "Sell"})
        ].copy()
    return result.reset_index(drop=True)


def apply_triple_barrier_three_day(df: pd.DataFrame, **kwargs) -> pd.DataFrame:
    return apply_triple_barrier_one_day(df, horizon_days=3, **kwargs)


def apply_triple_barrier_five_day(df: pd.DataFrame, **kwargs) -> pd.DataFrame:
    return apply_triple_barrier_one_day(df, horizon_days=5, **kwargs)


def apply_triple_barrier_by_ticker(
    df: pd.DataFrame,
    ticker_column: str = "Ticker",
    profit_taking_multiplier: float = 1.5,
    stop_loss_multiplier: float = 1.5,
    volatility_window: int = 20,
    min_return: float = 0.005,
    drop_ambiguous: bool = True,
    drop_unlabeled: bool = True,
    binary_only: bool = True,
    horizon_days: int = 1,
) -> pd.DataFrame:
    """Apply the labeling method to each ticker independently."""
    if ticker_column not in df.columns:
        raise ValueError(f"Column '{ticker_column}' not found in DataFrame.")
    labeled_data = []
    for ticker, ticker_df in df.groupby(ticker_column, sort=False):
        print(f"\nLabeling {ticker}...")
        labeled_ticker = apply_triple_barrier_one_day(
            df=ticker_df,
            profit_taking_multiplier=profit_taking_multiplier,
            stop_loss_multiplier=stop_loss_multiplier,
            volatility_window=volatility_window,
            min_return=min_return,
            drop_ambiguous=drop_ambiguous,
            drop_unlabeled=drop_unlabeled,
            binary_only=binary_only,
            horizon_days=horizon_days,
        )
        labeled_ticker[ticker_column] = ticker
        labeled_data.append(labeled_ticker)
    if not labeled_data:
        raise ValueError("No ticker data was available for labeling.")
    return (
        pd.concat(labeled_data, ignore_index=True)
        .sort_values(["Date", ticker_column])
        .reset_index(drop=True)
    )
