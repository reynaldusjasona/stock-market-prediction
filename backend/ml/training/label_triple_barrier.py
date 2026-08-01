from __future__ import annotations


import pandas as pd

LABELS = {"Buy", "Sell"}


def calculate_dynamic_target(
    df: pd.DataFrame,
    close_col: str = "Close",
    volatility_window: int = 20,
) -> pd.Series:
    """
    Calculate dynamic return target based on historical rolling volatility.

    Args:
        df (pd.DataFrame): DataFrame containing stock price data with a 'Close' column.
        close_col (str): Name of the column containing closing prices. Default is 'Close'.
        volatility_window (int): Window size for calculating rolling volatility. Default is 20.

    Returns:
        pd.Series: A Series containing the dynamic return target for each row in the DataFrame.

    The one-period shift ensures the target for day t uses only information available before day t.
    """

    if close_col not in df.columns:
        raise ValueError(f"Column '{close_col}' not found in DataFrame.")

    if volatility_window < 2:
        raise ValueError("volatility_window must be at least 2.")

    # Calculate daily returns
    close = pd.to_numeric(df[close_col], errors="coerce")
    daily_returns = close.pct_change()

    # Calculate dynamic target
    dynamic_target = (
        daily_returns
        .rolling(window=volatility_window, min_periods=volatility_window)
        .std()
        .shift(1)
    )

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
) -> pd.DataFrame:
    """
    Apply the triple barrier method to label each row in the DataFrame as 'Buy' or  'Sell'.

    For each day:
    - entry price = today' close price
    - upper barrier = entry price * (1 + profit_taking_multiplier * dynamic_target)
    - lower barrier = entry price * (1 - stop_loss_multiplier * dynamic_target)
    - examine next day's high and low prices to determine if either barrier was breached.
    
    - Buy: Tomorrow's high reaches the upper barrier only. 
    - Sell: Tomorrow's low reaches the lower barrier only. 
    - Ambigious: Both barriers are reached. Daily OHLC data cannot determine which barrier was touched first.

    - Buy: Tomorrow's high reaches the upper barrier only.
    - Sell: Tomorrow's low reaches the lower barrier only.
    - Hold: Neither barrier is reached
    - Ambigious: Both barriers are reached. Daily OHLC data cannot determine
      which barrier was touched first.

    Returns:
        pd.DataFrame: A DataFrame with triple barrier columns and  plus a 'Label' column with labels ('Buy' and 'Sell').
    """

    required_columns = {"Date", "High", "Low", close_col}
    missing_columns = required_columns.difference(df.columns)

    if missing_columns:
        raise ValueError(
            f"Missing required columns: {sorted(missing_columns)}"
        )

    if profit_taking_multiplier <= 0:
        raise ValueError(
            "profit_taking_multiplier must be greater than 0."
        )

    if stop_loss_multiplier <= 0:
        raise ValueError(
            "stop_loss_multiplier must be greater than 0."
        )

    if min_return < 0:
        raise ValueError("min_return must be non-negative.")

    result = df.copy()

    result["Date"] = pd.to_datetime(
        result["Date"],
        errors="coerce",
    )

    result = (result.sort_values("Date").reset_index(drop=True))

    for column in ["High", "Low", close_col]:
        result[column] = pd.to_numeric(
            result[column],
            errors="coerce",
        )

    result["dynamic_target"] = calculate_dynamic_target(
        result,
        close_col=close_col,
        volatility_window=volatility_window,
    )

    result["next_high"] = result["High"].shift(-1)
    result["next_low"] = result["Low"].shift(-1)

    result["upper_barrier_price"] = (
        result[close_col] * (1 + profit_taking_multiplier * result["dynamic_target"])
    )

    result["lower_barrier_price"] = (
        result[close_col] * (1 - stop_loss_multiplier * result["dynamic_target"])
    )

    result["Upper_Touched"] = (result["next_high"] >= result["upper_barrier_price"])

    result["Lower_Touched"] = (result["next_low"] <= result["lower_barrier_price"])

    valid_target = (
        result["dynamic_target"].notna()
        & (result["dynamic_target"] >= min_return)
        & result["next_high"].notna()
        & result["next_low"].notna()
    )

    upper_touched = result["Upper_Touched"]
    lower_touched = result["Lower_Touched"]

    buy_mask = (
        valid_target
        & upper_touched
        & ~lower_touched
    )

    sell_mask = (
        valid_target
        & lower_touched
        & ~upper_touched
    )

    hold_mask = (
        valid_target
        & ~upper_touched
        & ~lower_touched
    )

    ambiguous_mask = (
        valid_target
        & upper_touched
        & lower_touched
    )

    result["Label"] = pd.NA
    result["Barrier_Type"] = pd.NA

    result.loc[buy_mask, "Label"] = "Buy"
    result.loc[buy_mask, "Barrier_Type"] = "upper"

    result.loc[sell_mask, "Label"] = "Sell"
    result.loc[sell_mask, "Barrier_Type"] = "lower"

    result.loc[hold_mask, "Label"] = "Hold"
    result.loc[hold_mask, "Barrier_Type"] = "vertical"

    result.loc[
        ambiguous_mask,
        "Barrier_Type",
    ] = "ambiguous"

    valid_count = int(valid_target.sum())
    ambiguous_count = int(ambiguous_mask.sum())

    print(f"Valid labeling events: {valid_count}")
    print(f"Ambiguous events: {ambiguous_count}")

    if drop_ambiguous:
        result = result.loc[
            ~ambiguous_mask
        ].copy()
    
    if binary_only: 
        #exclude time-barrier events. 
        result = result.loc [
            result["Label"].isin(LABELS)
        ].copy()

    elif drop_unlabeled:
        result = result.loc[
            result["Label"].isin({"Buy", "Hold", "Sell"})
        ].copy()

    return result.reset_index(drop=True)


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
) -> pd.DataFrame: 

    """
    apply one day labeling method to each ticker
    """
    if ticker_column not in df.columns:
        raise ValueError(
            f"Column '{ticker_column}' not found in DataFrame."
        )

    labeled_data = []

    for ticker, ticker_df in df.groupby(
        ticker_column,
        sort=False,
    ):
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
        )

        labeled_ticker[ticker_column] = ticker
        labeled_data.append(labeled_ticker)

    if not labeled_data:
        raise ValueError(
            "No ticker data was available for labeling."
        )

    result = pd.concat(labeled_data, ignore_index=True)

    result = (
        result
        .sort_values(
            ["Date", ticker_column]
        )
        .reset_index(drop=True)
    )

    return result
