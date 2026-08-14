from __future__ import annotations

import functools
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from ml.training.evaluate import load_model
from ml.training.features import calculate_indicators, fetch_stock_data


SUPPORTED_HORIZONS = (1, 3, 5)
DEFAULT_MODEL_DIR = "ml/saved_models"


def _risk_level_for_confidence(confidence: float) -> str:
    if confidence >= 75:
        return "Low Risk"
    if confidence >= 50:
        return "Moderate Risk"
    return "High Risk"


def _artifact_suffix(horizon_days: int) -> str:
    if horizon_days not in SUPPORTED_HORIZONS:
        raise ValueError("horizon_days must be one of 1, 3, or 5.")
    return "" if horizon_days == 1 else f"_{horizon_days}day"


def _read_feature_manifest(
    model: object,
    model_dir: str,
    horizon_days: int,
) -> list[str]:
    """Load the exact ordered feature list used to train one horizon."""
    suffix = _artifact_suffix(horizon_days)
    manifest_path = Path(model_dir) / f"feature_manifest{suffix}.json"
    manifest_features: list[str] | None = None

    if manifest_path.exists():
        with manifest_path.open("r", encoding="utf-8") as file:
            manifest = json.load(file)

        if isinstance(manifest, list):
            manifest_features = manifest
        elif isinstance(manifest, dict):
            for key in ("feature_columns", "features", "selected_features"):
                value = manifest.get(key)
                if isinstance(value, list):
                    manifest_features = value
                    break

        if not manifest_features or not all(
            isinstance(column, str) for column in manifest_features
        ):
            raise ValueError(
                f"Invalid feature manifest format: {manifest_path.resolve()}"
            )

    model_features = list(getattr(model, "feature_names_in_", []))
    if manifest_features is None:
        if not model_features:
            raise FileNotFoundError(
                f"Feature manifest not found: {manifest_path.resolve()}, and "
                "the model does not contain feature_names_in_."
            )
        manifest_features = model_features

    if model_features and manifest_features != model_features:
        raise ValueError(
            f"{horizon_days}-day feature manifest does not match the trained "
            "model's feature order. Retrain or restore matching artifacts."
        )

    return list(manifest_features)


def _read_decision_threshold(model_dir: str, horizon_days: int) -> float:
    """Load the threshold chosen using validation data for one horizon."""
    suffix = _artifact_suffix(horizon_days)
    threshold_path = Path(model_dir) / f"decision_threshold{suffix}.json"
    if not threshold_path.exists():
        print(
            f"Warning: {threshold_path} not found; using the default "
            "decision threshold 0.50."
        )
        return 0.50

    with threshold_path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if isinstance(payload, (int, float)):
        threshold = float(payload)
    elif isinstance(payload, dict):
        threshold = None
        for key in ("decision_threshold", "threshold", "best_threshold"):
            if key in payload:
                threshold = float(payload[key])
                break
        if threshold is None:
            raise ValueError(
                f"No threshold value found in {threshold_path.resolve()}."
            )
    else:
        raise ValueError(
            f"Invalid decision-threshold format: {threshold_path.resolve()}"
        )

    if not 0 < threshold < 1:
        raise ValueError(
            f"Decision threshold must be between 0 and 1, received {threshold}."
        )
    return threshold


@functools.lru_cache(maxsize=len(SUPPORTED_HORIZONS))
def _load_horizon_artifacts(
    horizon_days: int,
    model_dir: str = DEFAULT_MODEL_DIR,
) -> tuple[object, object, tuple[str, ...], float, int, int]:
    model, label_encoder = load_model(
        model_dir=model_dir,
        horizon_days=horizon_days,
    )
    classes = [str(label) for label in label_encoder.classes_]
    if set(classes) != {"Buy", "Sell"} or len(classes) != 2:
        raise ValueError(
            f"Expected Buy/Sell classes for the {horizon_days}-day model, "
            f"received {classes}."
        )

    feature_columns = _read_feature_manifest(model, model_dir, horizon_days)
    threshold = _read_decision_threshold(model_dir, horizon_days)
    buy_index = classes.index("Buy")
    sell_index = classes.index("Sell")

    print(
        f"Loaded {horizon_days}-day model: classes={classes}, "
        f"features={len(feature_columns)}, sell_threshold={threshold:.2f}"
    )
    return (
        model,
        label_encoder,
        tuple(feature_columns),
        threshold,
        buy_index,
        sell_index,
    )


def _build_latest_feature_frame(
    ticker: str,
    start: str = "2020-01-01",
    end: str | None = None,
) -> pd.DataFrame:
    """Return one row of features for the latest available date."""
    if end is None:
        end = (date.today() + timedelta(days=1)).isoformat()
    raw = fetch_stock_data(ticker, start=start, end=end)
    processed = calculate_indicators(raw, ticker=ticker, start=start, end=end)
    if processed.empty:
        raise ValueError(
            f"No feature data available for ticker '{ticker}'. "
            "The ticker may be invalid or have insufficient history."
        )
    return processed.iloc[[-1]].copy()


def get_latest_features(
    ticker: str,
    horizon_days: int = 1,
    start: str = "2020-01-01",
    end: str | None = None,
    model_dir: str = DEFAULT_MODEL_DIR,
) -> pd.DataFrame:
    """Return one row in the exact feature order expected by a horizon."""
    model, _, feature_columns, _, _, _ = _load_horizon_artifacts(
        horizon_days, model_dir
    )
    processed = _build_latest_feature_frame(ticker, start=start, end=end)
    missing = [column for column in feature_columns if column not in processed]
    if missing:
        raise ValueError(
            f"Missing inference features for the {horizon_days}-day model: "
            f"{missing}"
        )
    features = processed.loc[:, list(feature_columns)]
    expected = list(getattr(model, "feature_names_in_", feature_columns))
    if features.columns.tolist() != expected:
        raise ValueError(
            f"{horizon_days}-day inference feature order does not match the model."
        )
    return features


@functools.lru_cache(maxsize=len(SUPPORTED_HORIZONS))
def _get_explainer(
    horizon_days: int,
    model_dir: str = DEFAULT_MODEL_DIR,
):
    import shap

    model, _, _, _, _, _ = _load_horizon_artifacts(horizon_days, model_dir)
    return shap.TreeExplainer(model)


def _build_shap_explanation(
    features: pd.DataFrame,
    horizon_days: int,
    predicted_index: int,
    buy_index: int,
    model_dir: str,
) -> tuple[list[dict], float | None]:
    try:
        explainer = _get_explainer(horizon_days, model_dir)
        shap_values = explainer.shap_values(features)

        if isinstance(shap_values, list):
            class_values = np.asarray(shap_values[predicted_index])[0]
            expected = np.asarray(explainer.expected_value)
            base_value = float(expected[predicted_index])
        else:
            values = np.asarray(shap_values)
            if values.ndim == 3:
                class_values = values[0, :, predicted_index]
                expected = np.asarray(explainer.expected_value)
                base_value = float(expected[predicted_index])
            else:
                class_values = values[0]
                if predicted_index == buy_index:
                    class_values = -class_values
                base_value = float(
                    np.asarray(explainer.expected_value).reshape(-1)[0]
                )

        impacts = sorted(
            zip(features.columns, class_values),
            key=lambda pair: abs(float(pair[1])),
            reverse=True,
        )[:10]
        return (
            [
                {"feature": feature, "impact": float(impact)}
                for feature, impact in impacts
            ],
            base_value,
        )
    except Exception as exc:
        print(
            f"Error computing {horizon_days}-day SHAP explanation: {exc}"
        )
        return [], None


def _predict_from_processed_features(
    ticker: str,
    processed: pd.DataFrame,
    horizon_days: int,
    model_dir: str,
) -> dict:
    (
        model,
        _,
        feature_columns,
        threshold,
        buy_index,
        sell_index,
    ) = _load_horizon_artifacts(horizon_days, model_dir)

    missing = [column for column in feature_columns if column not in processed]
    if missing:
        raise ValueError(
            f"Missing inference features for the {horizon_days}-day model: "
            f"{missing}"
        )
    features = processed.loc[:, list(feature_columns)]
    probabilities = np.asarray(model.predict_proba(features))[0]
    if probabilities.shape != (2,):
        raise ValueError(
            f"Expected two class probabilities, received {probabilities.shape}."
        )

    sell_probability = float(probabilities[sell_index])
    if sell_probability >= threshold:
        signal = "Sell"
        predicted_index = sell_index
    else:
        signal = "Buy"
        predicted_index = buy_index

    confidence = round(float(probabilities[predicted_index]) * 100, 2)
    shap_explanation, base_value = _build_shap_explanation(
        features=features,
        horizon_days=horizon_days,
        predicted_index=predicted_index,
        buy_index=buy_index,
        model_dir=model_dir,
    )

    row = features.iloc[0]
    reasoning_parts = [
        f"{horizon_days}-day {signal} signal at {confidence:.1f}% confidence",
        f"using a validation-selected Sell threshold of {threshold:.2f}",
    ]
    if "RSI14" in row:
        reasoning_parts.append(f"RSI14 is {row['RSI14']:.1f}")
    if "MACD" in row:
        reasoning_parts.append(f"MACD is {row['MACD']:.4f}")

    return {
        "ticker": ticker.upper(),
        "timeframe": f"{horizon_days}d",
        "horizon_days": horizon_days,
        "signal": signal,
        "confidence": confidence,
        "risk_level": _risk_level_for_confidence(confidence),
        "reasoning": ". ".join(reasoning_parts) + ".",
        "sell_probability": round(sell_probability * 100, 2),
        "decision_threshold": threshold,
        "shapExplanation": shap_explanation,
        "baseValue": base_value,
    }


def getPrediction(
    ticker: str,
    horizon_days: int = 1,
    model_dir: str = DEFAULT_MODEL_DIR,
) -> dict:
    """Generate one genuine horizon-specific Buy/Sell prediction."""
    try:
        processed = _build_latest_feature_frame(ticker)
        return _predict_from_processed_features(
            ticker=ticker,
            processed=processed,
            horizon_days=horizon_days,
            model_dir=model_dir,
        )
    except (FileNotFoundError, OSError, ValueError) as exc:
        print(f"Error generating {horizon_days}-day prediction: {exc}")
        return {"error": str(exc), "horizon_days": horizon_days}


def getMultiTimeframePredictions(
    ticker: str,
    model_dir: str = DEFAULT_MODEL_DIR,
) -> dict:
    """Run the independent 1-, 3-, and 5-day models on one feature row."""
    try:
        processed = _build_latest_feature_frame(ticker)
        predictions = [
            _predict_from_processed_features(
                ticker=ticker,
                processed=processed,
                horizon_days=horizon_days,
                model_dir=model_dir,
            )
            for horizon_days in SUPPORTED_HORIZONS
        ]
    except (FileNotFoundError, OSError, ValueError) as exc:
        print(f"Error generating multi-timeframe prediction: {exc}")
        return {"error": str(exc)}

    one_day = predictions[0]
    return {
        **one_day,
        "predictions": predictions,
    }


if __name__ == "__main__":
    print(getMultiTimeframePredictions("AAPL"))
