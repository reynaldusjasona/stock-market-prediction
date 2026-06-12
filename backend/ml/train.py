import shutil
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight

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
    Train an XGBClassifier using GridSearchCV over a hyperparameter grid.

    y_train must already be a label-encoded integer array (from the
    LabelEncoder fitted in run_training). GridSearchCV uses TimeSeriesSplit
    with 3 folds and accuracy scoring to find the best combination of
    n_estimators, max_depth, and learning_rate.

    Returns the best_estimator_ from the grid search.
    """
    param_grid = {
        "n_estimators": [100, 300, 500],
        "max_depth": [3, 5, 8],
        "learning_rate": [0.01, 0.1, 0.3],
    }
    base_model = xgb.XGBClassifier(
        eval_metric="mlogloss",
        random_state=42,
    )
    cv = TimeSeriesSplit(n_splits=3)
    grid_search = GridSearchCV(
        estimator=base_model,
        param_grid=param_grid,
        cv=cv,
        scoring="accuracy",
        n_jobs=1,
        verbose=1,
    )
    sample_weight = compute_sample_weight(class_weight="balanced", y=y_train)
    grid_search.fit(X_train, y_train, sample_weight=sample_weight)
    print(f"Best parameters: {grid_search.best_params_}")
    print(f"Best CV accuracy: {grid_search.best_score_:.4f}")
    return grid_search.best_estimator_


def save_model(
    model: xgb.XGBClassifier,
    label_encoder: LabelEncoder,
    save_dir: str = "ml/saved_models",
) -> str:
    """
    Persist the trained model and its LabelEncoder to disk.

    Creates save_dir (and any missing parents) if it does not already exist.
    Saves:
      <save_dir>/xgboost_model_YYYYMMDD_HHMMSS.joblib — timestamped model
      <save_dir>/xgboost_model_latest.joblib           — copy of the latest model
      <save_dir>/label_encoder.pkl                     — the fitted LabelEncoder

    Returns the absolute path string of the timestamped model file.
    """
    save_path = Path(save_dir)
    save_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_file = save_path / f"xgboost_model_{timestamp}.joblib"
    latest_file = save_path / "xgboost_model_latest.joblib"
    encoder_file = save_path / "label_encoder.pkl"

    joblib.dump(model, model_file)
    shutil.copy2(model_file, latest_file)
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
