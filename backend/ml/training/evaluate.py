import argparse

import joblib
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import LabelEncoder

from ml.training.features import (
    get_feature_columns_for_horizon,
    get_multiple_tickers,
)
from ml.training.label_triple_barrier import apply_triple_barrier_by_ticker
from ml.training.train_common import (
    TRAIN_TICKERS,
    get_artifact_paths,
    get_model_feature_columns,
    split_data,
)


def load_model(
    model_dir: str = "ml/saved_models",
    horizon_days: int = 1,
) -> tuple[xgb.XGBClassifier, LabelEncoder]:
    """Load the model and encoder belonging to exactly one horizon."""
    paths = get_artifact_paths(model_dir, horizon_days)
    model_file = paths["latest_model"]
    encoder_file = paths["label_encoder"]
    if not model_file.exists():
        raise FileNotFoundError(
            f"Model file not found: {model_file.resolve()}. "
            f"Train the {horizon_days}-day model first."
        )
    if not encoder_file.exists():
        raise FileNotFoundError(
            f"Encoder file not found: {encoder_file.resolve()}. "
            f"Train the {horizon_days}-day model first."
        )
    return joblib.load(model_file), joblib.load(encoder_file)


def evaluate_model(
    model: xgb.XGBClassifier,
    label_encoder: LabelEncoder,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> dict:
    y_test_encoded = label_encoder.transform(y_test)
    y_predicted = model.predict(X_test)
    probabilities = model.predict_proba(X_test)
    if probabilities.ndim != 2 or probabilities.shape[1] != 2:
        raise ValueError(
            "Expected binary probabilities with shape (n, 2), "
            f"received {probabilities.shape}."
        )
    print(classification_report(
        y_test_encoded,
        y_predicted,
        target_names=label_encoder.classes_,
        zero_division=0,
    ))
    matrix = confusion_matrix(y_test_encoded, y_predicted)
    auc = roc_auc_score(y_test_encoded, probabilities[:, 1])
    print("Confusion Matrix:")
    print(matrix)
    print(f"ROC-AUC Score (binary): {auc:.4f}")
    return {
        "accuracy": round(accuracy_score(y_test_encoded, y_predicted), 4),
        "precision": round(precision_score(
            y_test_encoded, y_predicted, average="weighted", zero_division=0
        ), 4),
        "recall": round(recall_score(
            y_test_encoded, y_predicted, average="weighted", zero_division=0
        ), 4),
        "f1": round(f1_score(
            y_test_encoded, y_predicted, average="weighted", zero_division=0
        ), 4),
        "confusion_matrix": matrix.tolist(),
        "roc_auc": round(auc, 4),
    }


def run_evaluation(
    horizon_days: int = 1,
    model_dir: str = "ml/saved_models",
) -> dict:
    """Rebuild and evaluate the untouched test split for one horizon."""
    if horizon_days not in {1, 3, 5}:
        raise ValueError("horizon_days must be one of 1, 3, or 5.")
    print(f"\n=== EVALUATING {horizon_days}-DAY MODEL ===")
    model, label_encoder = load_model(model_dir, horizon_days)
    combined = get_multiple_tickers(TRAIN_TICKERS)
    labeled = apply_triple_barrier_by_ticker(
        df=combined,
        ticker_column="Ticker",
        profit_taking_multiplier=1.5,
        stop_loss_multiplier=1.5,
        volatility_window=20,
        min_return=0.005,
        drop_ambiguous=True,
        drop_unlabeled=True,
        binary_only=True,
        horizon_days=horizon_days,
    )
    feature_whitelist = get_feature_columns_for_horizon(horizon_days)
    feature_columns = get_model_feature_columns(
        labeled,
        feature_whitelist,
    )
    X = labeled[feature_columns].copy()
    y = labeled["Label"].astype(str)
    dates = pd.to_datetime(labeled["Date"], errors="raise")
    _, _, X_test, _, _, y_test = split_data(
        X, y, dates=dates, purge_days=horizon_days
    )
    expected_features = list(getattr(model, "feature_names_in_", feature_columns))
    if expected_features != feature_columns:
        raise ValueError(
            "Evaluation feature order differs from the trained model. "
            f"Expected {expected_features}, rebuilt {feature_columns}."
        )
    print(f"Test set size: {len(X_test)}")
    print(f"Feature count: {len(feature_columns)}")
    print(f"Features: {feature_columns}")
    metrics = evaluate_model(model, label_encoder, X_test, y_test)
    importance = pd.DataFrame({
        "Feature": feature_columns,
        "Importance": model.feature_importances_,
    })
    print(importance.sort_values("Importance", ascending=False).head(15))
    print(metrics)
    return metrics


def run_evaluation_three_day(**kwargs) -> dict:
    return run_evaluation(horizon_days=3, **kwargs)


def run_evaluation_five_day(**kwargs) -> dict:
    return run_evaluation(horizon_days=5, **kwargs)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--horizon", choices=("1", "3", "5", "all"), default="5")
    parser.add_argument("--model-dir", default="ml/saved_models")
    args = parser.parse_args()
    horizons = (1, 3, 5) if args.horizon == "all" else (int(args.horizon),)
    results = {}
    for horizon in horizons:
        results[f"{horizon}day"] = run_evaluation(
            horizon_days=horizon,
            model_dir=args.model_dir,
        )
    print(results)


if __name__ == "__main__":
    main()
