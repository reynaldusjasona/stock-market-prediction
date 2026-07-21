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
from ml.training.train import TRAIN_TICKERS, split_data

_MODEL_FILE = "xgboost_model_latest.joblib"
_ENCODER_FILE = "label_encoder.pkl"


def load_model(
    model_dir: str = "ml/saved_models",
) -> tuple[xgb.XGBClassifier, LabelEncoder]:
    """
    Load the trained XGBClassifier and LabelEncoder from disk.

    Expects both xgboost_model.pkl and label_encoder.pkl to exist inside
    model_dir. Raises FileNotFoundError with a descriptive message if either
    file is missing.

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

    roc_auc = round(
        roc_auc_score(
            y_test_enc, y_proba,
            multi_class="ovr", average="weighted",
        ), 4
    )
    print(f"\nROC-AUC Score (weighted OvR): {roc_auc}")

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
    X, y = get_multiple_tickers(TRAIN_TICKERS)
    _, _, X_test, _, _, y_test = split_data(X, y)

    print(f"Test set size: {len(X_test)}")
    metrics = evaluate_model(model, label_encoder, X_test, y_test)

    print(f"Accuracy : {metrics['accuracy']}")
    print(f"Precision: {metrics['precision']}")
    print(f"Recall   : {metrics['recall']}")
    print(f"F1       : {metrics['f1']}")


    return metrics


if __name__ == "__main__":
    result = run_evaluation()
    print(result)
