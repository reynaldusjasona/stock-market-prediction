from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder

from ml.features import get_multiple_tickers

TRAIN_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
    "META", "TSLA", "JPM", "JNJ", "XOM",
]


def split_data(
    X: pd.DataFrame, y: pd.Series
) -> tuple[
    pd.DataFrame, pd.DataFrame, pd.DataFrame,
    pd.Series, pd.Series, pd.Series,
]:
    """
    Perform a time-based (no-shuffle) 70/15/15 train/val/test split.

    Split indices are computed from len(X) so the chronological ordering
    of the concatenated multi-ticker DataFrame is preserved.

    Returns X_train, X_val, X_test, y_train, y_val, y_test.
    """
    n = len(X)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)

    X_train = X.iloc[:train_end]
    X_val = X.iloc[train_end:val_end]
    X_test = X.iloc[val_end:]

    y_train = y.iloc[:train_end]
    y_val = y.iloc[train_end:val_end]
    y_test = y.iloc[val_end:]

    return X_train, X_val, X_test, y_train, y_val, y_test


def train_model(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val: pd.DataFrame,
    y_val: np.ndarray,
) -> xgb.XGBClassifier:
    """
    Train an XGBClassifier with fixed hyperparameters and early stopping.

    y_train and y_val must already be label-encoded integer arrays (from
    the LabelEncoder fitted in run_training). Early stopping monitors
    mlogloss on the validation set and halts after 20 non-improving rounds.

    Returns the fitted XGBClassifier.
    """
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        use_label_encoder=False,
        eval_metric="mlogloss",
        random_state=42,
        early_stopping_rounds=20,
    )
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    return model


def save_model(
    model: xgb.XGBClassifier,
    label_encoder: LabelEncoder,
    save_dir: str = "ml/saved_models",
) -> str:
    """
    Persist the trained model and its LabelEncoder to disk.

    Creates save_dir (and any missing parents) if it does not already exist.
    Saves:
      <save_dir>/xgboost_model.pkl  — the fitted XGBClassifier
      <save_dir>/label_encoder.pkl  — the fitted LabelEncoder

    Returns the absolute path string of the saved model file.
    """
    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)

    model_file = save_path / "xgboost_model.pkl"
    encoder_file = save_path / "label_encoder.pkl"

    joblib.dump(model, model_file)
    joblib.dump(label_encoder, encoder_file)

    return str(model_file.resolve())


def run_training() -> dict:
    """
    Orchestrate the full training pipeline end-to-end.

    Steps:
      1. Fetch and engineer features for all 10 training tickers.
      2. Split into train / val / test sets (time-based, no shuffle).
      3. Fit a LabelEncoder on y_train; transform y_train and y_val.
      4. Train the XGBClassifier with early stopping on the val set.
      5. Save model and encoder to backend/ml/saved_models/.
      6. Print sample counts, class distribution, and saved path.

    Returns a dict with keys: model_path, n_train, n_val, n_test.
    """
    print("Fetching feature data for all tickers...")
    X, y = get_multiple_tickers(TRAIN_TICKERS)

    X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)

    le = LabelEncoder()
    y_train_enc = le.fit_transform(y_train)
    y_val_enc = le.transform(y_val)

    print(f"Training samples : {len(X_train)}")
    print(f"Validation samples: {len(X_val)}")
    print(f"Test samples     : {len(X_test)}")
    print(f"Class distribution (train):\n{y_train.value_counts()}")
    print(f"Label encoder classes: {list(le.classes_)}")

    print("Training XGBoost classifier...")
    model = train_model(X_train, y_train_enc, X_val, y_val_enc)

    model_path = save_model(model, le)
    print(f"Model saved to: {model_path}")

    return {
        "model_path": model_path,
        "n_train": len(X_train),
        "n_val": len(X_val),
        "n_test": len(X_test),
    }


if __name__ == "__main__":
    result = run_training()
    print(result)
