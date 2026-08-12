import functools
from pathlib import Path

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

from ml.training.features import get_multiple_tickers
from ml.training.train_common import TRAIN_TICKERS, split_data
from ml.training.label_triple_barrier import apply_triple_barrier_by_ticker

_MODEL_FILE = "xgboost_model_latest.joblib"
_ENCODER_FILE = "label_encoder.pkl"


@functools.lru_cache(maxsize=1)
def load_model(
    model_dir: str = "ml/saved_models",
) -> tuple[xgb.XGBClassifier, LabelEncoder]:
    """
    Load the trained XGBClassifier and LabelEncoder from disk.

    Expects both xgboost_model.pkl and label_encoder_3class.pkl to exist inside
    model_dir. Raises FileNotFoundError with a descriptive message if either
    file is missing.

    Cached in memory after the first successful load (per model_dir), so
    repeated predictions don't re-read and re-deserialize the .joblib files
    from disk on every request.

    Returns (model, label_encoder).
    """
    dir_path = Path(model_dir)
    model_file = dir_path / _MODEL_FILE
    encoder_file = dir_path / _ENCODER_FILE

    if not model_file.exists():
        raise FileNotFoundError(
            f"Model file not found: {model_file.resolve()}. "
            "Run ml/train.py first to generate it."
        )
    if not encoder_file.exists():
        raise FileNotFoundError(
            f"Label encoder file not found: {encoder_file.resolve()}. "
            "Run ml/train.py first to generate it."
        )

    model = joblib.load(model_file)
    label_encoder = joblib.load(encoder_file)
    return model, label_encoder


def evaluate_model(
    model: xgb.XGBClassifier,
    label_encoder: LabelEncoder,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> dict:
    """
    Evaluate a trained XGBClassifier on the held-out test set.

    Encodes y_test with label_encoder, runs model.predict, then computes
    accuracy, weighted precision, weighted recall, and weighted F1. Prints
    the full sklearn classification_report to stdout before returning.

    All returned metric values are rounded to 4 decimal places.

    Returns a dict with keys: accuracy, precision, recall, f1.
    """
    y_test_enc = label_encoder.transform(y_test)
    y_pred_enc = model.predict(X_test)
    y_proba = model.predict_proba(X_test)

    report = classification_report(
        y_test_enc,
        y_pred_enc,
        target_names=label_encoder.classes_,
        output_dict=False,
    )
    print(report)

    cm = confusion_matrix(y_test_enc, y_pred_enc)
    print("Confusion Matrix:")
    print(cm)

    if y_proba.ndim != 2 or y_proba.shape[1] != 2:
        raise ValueError(
            f"Expected binary class probabilities with shape (n, 2), "
            f"but received {y_proba.shape}."
        )

    roc_auc = round(
        roc_auc_score(y_test_enc, y_proba[:, 1]),
        4,
    )
    print(f"\nROC-AUC Score (binary): {roc_auc}")

    return {
        "accuracy": round(accuracy_score(y_test_enc, y_pred_enc), 4),
        "precision": round(
            precision_score(
                y_test_enc, y_pred_enc,
                average="weighted", zero_division=0,
            ), 4
        ),
        "recall": round(
            recall_score(
                y_test_enc, y_pred_enc,
                average="weighted", zero_division=0,
            ), 4
        ),
        "f1": round(
            f1_score(
                y_test_enc, y_pred_enc,
                average="weighted", zero_division=0,
            ), 4
        ),
        "confusion_matrix": cm.tolist(),
        "roc_auc": roc_auc,
    }


def run_evaluation() -> dict:
    """
    Orchestrate the full evaluation pipeline end-to-end.

    Steps:
      1. Load the trained model and encoder from ml/saved_models/.
      2. Rebuild the same dataset used during training (same 10 tickers,
         same split_data call) to obtain the identical held-out test set.
      3. Evaluate the model on X_test / y_test.
      4. Print the test set size and each scalar metric.

    Returns the metrics dict produced by evaluate_model().
    """
    model, label_encoder = load_model()

    print("Rebuilding dataset for evaluation...")
    combined = get_multiple_tickers(TRAIN_TICKERS)
    labeled_data = apply_triple_barrier_by_ticker(
        df=combined,
        ticker_column="Ticker",
        profit_taking_multiplier=1.5,
        stop_loss_multiplier=1.5,
        volatility_window=20,
        min_return=0.005,
        drop_ambiguous=True,
        drop_unlabeled=True,
        binary_only=True,
    )

    excluded_columns = [
        "Date",
        "Ticker",
        "Label",

        # Triple Barrier columns
        "dynamic_target",
        "next_high",
        "next_low",
        "next_close",
        "upper_barrier_price",
        "lower_barrier_price",
        "Upper_Touched",
        "Lower_Touched",
        "Barrier_Type",
        "High", "Low",
    ]

    feature_columns = [
        col
        for col in labeled_data.columns
        if col not in excluded_columns
    ]

    X = labeled_data[feature_columns]
    y = labeled_data["Label"].astype(str)
    _, _, X_test, _, _, y_test = split_data(X, y)

    test_size = len(X_test)
    print(f"Test set size: {test_size}")
    metrics = evaluate_model(model, label_encoder, X_test, y_test)
    metrics["test_size"] = test_size

    print(f"Accuracy : {metrics['accuracy']}")
    print(f"Precision: {metrics['precision']}")
    print(f"Recall   : {metrics['recall']}")
    print(f"F1       : {metrics['f1']}")

    importance = pd.DataFrame({
        "Feature": X.columns,
        "Importance": model.feature_importances_
    })

    print(
        importance.sort_values(
            "Importance",
            ascending=False
        ).head(15)
    )

    return metrics


def save_metrics_to_db(metrics: dict, test_size: int) -> None:
    """
    Upsert evaluation metrics into the Supabase prediction_metrics
    table so the admin dashboard always reflects the latest model.
    """
    from app.core.database import supabase
    from datetime import datetime, timezone

    row = {
        "accuracy": metrics["accuracy"],
        "precision_score": metrics["precision"],
        "recall_score": metrics["recall"],
        "f1_score": metrics["f1"],
        "total_predictions": test_size,
        "model_version": f"xgboost_v2_{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "notes": (
            f"Binary classification (Buy/Sell). "
            f"Triple barrier labeling, {len(TRAIN_TICKERS)} tickers, "
            f"37 features. ROC-AUC: {metrics.get('roc_auc', 'N/A')}. "
            f"Auto-saved by evaluation pipeline."
        ),
    }

    existing = (
        supabase.table("prediction_metrics")
        .select("id")
        .order("evaluated_at", desc=True)
        .limit(1)
        .execute()
    )

    if existing.data:
        supabase.table("prediction_metrics").update(row).eq(
            "id", existing.data[0]["id"]
        ).execute()
        print(f"Updated prediction_metrics row {existing.data[0]['id']}")
    else:
        supabase.table("prediction_metrics").insert(row).execute()
        print("Inserted new prediction_metrics row")


if __name__ == "__main__":
    result = run_evaluation()
    print(result)

    print("\nSaving metrics to Supabase...")
    try:
        save_metrics_to_db(result, test_size=result["test_size"])
        print("Metrics saved to prediction_metrics table.")
    except Exception as exc:
        print(f"Failed to save metrics to DB: {exc}")
        print("Metrics were printed above — update manually if needed.")
